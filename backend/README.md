# Simulador de Entregas por Drone — API

API REST em **NestJS + TypeScript** que registra pedidos, gerencia uma frota de drones e
calcula o plano de entregas otimizado: aloca os pedidos pendentes no menor número de
viagens possível, respeitando capacidade de carga, autonomia, bateria e desviando das
zonas de exclusão aérea. Um relógio de simulação move os drones pela malha em tempo real.

---

## Sumário

- [Stack](#stack)
- [Como rodar](#como-rodar)
- [Arquitetura](#arquitetura)
- [Modelo de domínio](#modelo-de-domínio)
- [Regras de negócio](#regras-de-negócio)
- [Parâmetros da simulação](#parâmetros-da-simulação)
- [API](#api)
- [Testes](#testes)

---

## Stack

| Item | Versão / escolha |
| --- | --- |
| Runtime | Node.js 18+ |
| Framework | NestJS 10 |
| Linguagem | TypeScript 5 |
| Validação | `class-validator` + `class-transformer` |
| Documentação | Swagger (`@nestjs/swagger`) |
| Testes | Jest 29 + `ts-jest` + `supertest` |
| Persistência | Em memória (`Map`) — sem banco, o estado vive no processo |

---

## Como rodar

### Pré-requisitos

- Node.js 18 ou superior
- npm

### Instalação

```bash
npm install
```

### Subir a API

```bash
# desenvolvimento com hot reload
npm run start:dev

# desenvolvimento simples
npm run start

# produção (compila e executa o bundle)
npm run build
npm run start:prod
```

A API sobe em **`http://localhost:3000`**.
A documentação interativa (Swagger UI) fica em **`http://localhost:3000/docs`**.

> O CORS já vem habilitado e o `ValidationPipe` global roda com
> `whitelist`, `forbidNonWhitelisted` e `transform` ligados — payload com campo
> desconhecido é rejeitado com **400**.

**Logs.** Por padrão saem apenas `error`, `warn` e `log`, e o `log` registra só os
eventos que mudam estado (viagem despachada, concluída, abortada por bateria) — o
planejamento em si é uma consulta pura, chamada a cada tick e a cada `GET
/entregas/rota`, então não polui o console. Para ver o raciocínio do planejador
passo a passo:

```bash
LOG_LEVEL=debug npm run start:dev
```

### Scripts disponíveis

| Comando | O que faz |
| --- | --- |
| `npm run start:dev` | Sobe a API em watch mode |
| `npm run build` | Compila para `dist/` |
| `npm run start:prod` | Executa o build compilado |
| `npm test` | Roda a suíte unitária/integração (Jest) |
| `npm run test:watch` | Jest em watch mode |
| `npm run test:cov` | Suíte + relatório de cobertura em `coverage/` |
| `npm run test:e2e` | Suíte end-to-end (HTTP, via supertest) |
| `npm run lint` | ESLint com `--fix` |
| `npm run format` | Prettier em `src/` e `test/` |

### Roteiro rápido de uso

```bash
# 1. cadastrar um drone
curl -X POST http://localhost:3000/drones \
  -H 'Content-Type: application/json' \
  -d '{"name":"Falcão","capacityKg":10,"rangeKm":60,"speedKmh":40}'

# 2. registrar um pedido
curl -X POST http://localhost:3000/pedidos \
  -H 'Content-Type: application/json' \
  -d '{"location":{"x":5,"y":8},"weightKg":3.5,"priority":"alta"}'

# 3. (opcional) criar uma zona de exclusão aérea
curl -X POST http://localhost:3000/zonas \
  -H 'Content-Type: application/json' \
  -d '{"name":"Centro","minX":3,"minY":3,"maxX":6,"maxY":6}'

# 4. ver o plano de entregas
curl http://localhost:3000/entregas/rota

# 5. acompanhar o relógio da simulação
curl http://localhost:3000/entregas/simulacao
```

---

## Arquitetura

Organização modular do Nest, com separação entre **contrato HTTP** (DTOs), **domínio**
(interfaces) e **regra de negócio** (services). Nenhum controller carrega lógica.

```
src/
├── main.ts                      # bootstrap: CORS, ValidationPipe global, Swagger
├── app.module.ts                # composição dos módulos
├── config/
│   └── swagger.config.ts
├── common/
│   ├── config/simulation.config.ts   # constantes físicas da simulação
│   ├── enums/                        # DroneState, Priority
│   ├── interfaces/                   # Coordinate, Rect
│   └── utils/
│       ├── geo.util.ts               # A* na malha, desvio de zonas, polilinhas
│       └── flight.util.ts            # custo de voo: tempo e bateria
├── modules/
│   ├── drones/       # cadastro e estado da frota
│   ├── orders/       # registro e ciclo de vida dos pedidos
│   ├── zones/        # zonas de exclusão aérea
│   └── deliveries/
│       ├── deliveries.service.ts     # planejador de alocação
│       └── simulation.service.ts     # relógio, voo, recarga, despacho
└── testing/                          # helpers compartilhados de teste
```

Cada módulo segue o mesmo desenho:

```
<módulo>/
├── <módulo>.controller.ts
├── <módulo>.service.ts
├── <módulo>.module.ts
├── dto/
│   ├── forms/        # entrada (validada por class-validator)
│   └── responses/    # saída (com fromDomain estático)
└── interfaces/       # tipos de domínio
```

### Fluxo de uma entrega

```
POST /pedidos ──► OrdersService.create
                   ├─ valida destino fora de zona de exclusão
                   ├─ valida peso ≤ maior capacidade da frota
                   └─ valida ida e volta ≤ alcance útil da frota
                        │
                        ▼
              DeliveriesService.plan()  (a cada tick, e sob demanda em GET /entregas/rota)
                   ├─ ordena a fila por prioridade e depois por chegada
                   ├─ descarta os inviáveis com motivo textual
                   ├─ percorre os drones do maior para o menor
                   ├─ enche cada viagem respeitando peso, alcance e reserva de bateria
                   └─ ordena as paradas por vizinho mais próximo
                        │
                        ▼
              SimulationService.tick()  (a cada 1s = 0,5 min simulado)
                   ├─ avança os voos ativos (carregando → cruzeiro → entrega → retorno)
                   ├─ recarrega quem está ocioso na base
                   └─ despacha o plano novo
```

### Alocação

O planejador é uma **heurística gulosa em dois níveis**:

1. **Montagem das viagens — First-Fit Decreasing.** Um problema de *bin packing* com
   três restrições simultâneas (peso, alcance e bateria): os drones são os
   contêineres, percorridos em ordem **decrescente** de capacidade; cada pedido da
   fila entra na **primeira** viagem em que ainda cabe sem violar nenhuma das três.
   Ordenar os drones do maior para o menor é o que reduz o número de viagens — é a
   parte "decreasing" da heurística.
2. **Ordenação das paradas — vizinho mais próximo.** Fechada a carga, a sequência
   base → entregas → base é um *TSP*, resolvido pela heurística do vizinho mais
   próximo a partir da base (`sortByRoute`), medindo sempre a distância **real**
   com desvio de zonas, não a linha reta.

**Por que guloso e não a solução ótima.** Bin packing e TSP são NP-difíceis; para a
frota e a fila desta simulação o ganho de um solver exato seria marginal e o custo,
imprevisível. O planejador roda **a cada tick (1 s) e também sob demanda** em
`GET /entregas/rota`, então tempo de resposta limitado e determinismo valem mais que
otimalidade: a mesma fila sempre produz o mesmo plano (coberto por teste), e todo
pedido que sobra sai com **motivo textual** — uma busca exata daria um número melhor
sem conseguir explicar a recusa ao operador.

**Custo.** O laço de montagem testa cada candidato contra a rota parcial já formada,
e cada teste reordena as paradas por vizinho mais próximo — no pior caso `O(n³)`
chamadas de `travelDistance` por drone. Duas coisas seguram isso na prática: sem
zonas cadastradas `travelDistance` cai para distância euclidiana direta, sem A\*; e a
malha tem só 441 células, então mesmo o caminho com A\* é barato. O teste de carga
(60 pedidos / 6 drones) roda folgado dentro de um tick. Se a fila ou a malha
crescerem uma ordem de grandeza, o próximo passo é cachear as distâncias par a par
entre paradas — hoje elas são recalculadas a cada tentativa.

### Roteamento

`geo.util.ts` implementa **A\* em malha 21×21 (0..20)** com movimento em 8 direções,
custo `1` para ortogonal e `√2` para diagonal. As zonas de exclusão viram uma máscara
`Uint8Array`; a diagonal não "corta a quina" entre duas células bloqueadas. O caminho
retornado passa por `simplifyPath`, que remove pontos colineares sem alterar a
distância total — a polilinha enviada ao front fica enxuta.

A heurística é a **distância octile** (`max(dx,dy) + (√2−1)·min(dx,dy)`), admissível
para o conjunto de movimentos usado, o que garante caminho ótimo. A fila de abertos é
uma varredura linear em vez de heap binário: com 441 células o overhead de um heap
não se paga, e o código fica legível.

### Escala

O estado vive **em memória, num processo só**, e o relógio é um `setInterval` de 1 s
no `SimulationService`. Isso é deliberado: o escopo é uma simulação determinística e
autocontida, que sobe com um `npm run start:dev` e sem infraestrutura externa.

O passo natural de evolução é **orientar a simulação a eventos dentro do processo** —
`order.created`, `trip.dispatched`, `order.delivered` via `EventEmitter2` do Nest.
Isso desacopla o `SimulationService` de `OrdersService`/`DronesService`, que hoje ele
chama direto, e dá o gancho pronto para empurrar atualizações ao front por WebSocket
em vez de o front ficar consultando `GET /entregas/rota` em laço.

**Broker de mensageria (Kafka, RabbitMQ) não entra aqui.** Ele resolve durabilidade
entre processos, múltiplos consumidores, replay e backpressure entre serviços —
nenhum desses problemas existe com um processo único e estado em memória; o que
entraria seria só custo operacional e mais um ponto de falha. O momento de trocar o
`EventEmitter2` por tópicos reais é quando aparecer **persistência e mais de uma
instância da API**: aí o plano precisa sobreviver a restart, o despacho não pode
rodar duas vezes em paralelo, e os mesmos nomes de evento acima viram tópicos sem
mudar o domínio.

---

## Modelo de domínio

### Malha

Grade de `0..20` em X e Y (`GRID_SIZE = 20`). A **base** fica em `(0, 0)`: toda viagem
parte dela e volta para ela.

### Drone

| Campo | Descrição |
| --- | --- |
| `capacityKg` | Carga máxima por viagem |
| `rangeKm` | Autonomia com bateria cheia |
| `speedKmh` | Velocidade de cruzeiro (padrão 40) |
| `state` | `idle`, `loading`, `in_flight`, `delivering`, `returning` |
| `position` | Posição atual na malha |
| `batteryPercent` | Carga atual (0–100) |
| `deliveriesCompleted` | Contador acumulado de entregas |

### Pedido

| Campo | Descrição |
| --- | --- |
| `location` | Destino `(x, y)`, inteiros dentro da malha |
| `weightKg` | Peso do pacote (até 3 casas decimais) |
| `priority` | `baixa`, `media` ou `alta` |
| `status` | `pending` → `allocated` → `in_transit` → `delivered` |
| `deliveryMinutes` | Minutos de simulação até a entrega |

### Zona de exclusão

Retângulo `minX/minY/maxX/maxY` com **limites inclusivos**. Não pode cobrir a base —
a frota ficaria presa.

---

## Regras de negócio

**Recusa no registro do pedido** (`422 Unprocessable Entity`):

1. Destino dentro de uma zona de exclusão.
2. Destino cercado por zonas, sem rota possível.
3. Peso acima da capacidade do maior drone da frota.
4. Ida e volta acima do **alcance útil** do maior drone
   (`rangeKm × (1 − reserva)`, ou seja 85% da autonomia).

> Com a frota vazia, os limites 3 e 4 não se aplicam — só os geométricos.

**Alocação** (`DeliveriesService.plan`):

1. A fila é ordenada por **prioridade** (alta → média → baixa) e, dentro da mesma
   prioridade, por **ordem de chegada** (FIFO).
2. Os drones são percorridos da **maior capacidade** para a menor; empate desempata
   pela **maior bateria**.
3. Uma viagem só recebe mais um pedido se, com ele, continuar respeitando as três
   restrições ao mesmo tempo: peso ≤ capacidade, distância ≤ autonomia e bateria
   suficiente para voltar **com a reserva intacta**.
4. Cada drone recebe **no máximo uma viagem por plano**.
5. As paradas são ordenadas por **vizinho mais próximo** a partir da base.
6. Todo pedido não alocado sai do plano com um **motivo textual** explicando o porquê.

**Bateria:**

- Consumo por distância: `100 / rangeKm` por km percorrido.
- Consumo por tempo de motor ligado (carregamento e entrega): `0,4 %/min`.
- Um drone só é despachado com bateria ≥ **20%** (piso de despacho).
- Uma viagem só é planejada se o drone pousar com ≥ **15%** (reserva).
- Se a bateria zerar em voo, a viagem é **abortada**: o drone volta à base e os
  pedidos a bordo **retornam à fila**.
- Drone ocioso na base recarrega **6 %/min** simulado.

---

## Parâmetros da simulação

Todos centralizados em `src/common/config/simulation.config.ts`:

| Constante | Valor | Significado |
| --- | --- | --- |
| `GRID_SIZE` | 20 | Malha de 0 a 20 em X e Y |
| `DEFAULT_SPEED_KMH` | 40 | Velocidade padrão do drone |
| `MIN_SPEED_KMH` / `MAX_SPEED_KMH` | 5 / 150 | Faixa aceita no cadastro |
| `SERVICE_MINUTES_PER_STOP` | 2 | Tempo parado em cada entrega |
| `LOADING_MINUTES` | 3 | Carregamento na base antes de decolar |
| `BATTERY_RESERVE_PERCENT` | 15 | Reserva obrigatória ao pousar |
| `MIN_DISPATCH_BATTERY_PERCENT` | 20 | Piso de bateria para decolar |
| `HOVER_DRAIN_PER_MINUTE` | 0,4 | Consumo com motor ligado parado |
| `RECHARGE_PERCENT_PER_MINUTE` | 6 | Recarga na base |
| `TICK_MS` | 1000 | Intervalo real entre ticks |
| `SIM_MINUTES_PER_TICK` | 0,5 | Minutos simulados por tick |

---

## API

Base: `http://localhost:3000` · Documentação completa: `/docs`

### Drones

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/drones` | Cadastra um drone na frota |
| `GET` | `/drones` | Lista os drones cadastrados |
| `GET` | `/drones/status` | Status operacional (bateria, estado, posição, alcance restante) |

<details>
<summary><code>POST /drones</code></summary>

```json
{ "name": "Falcão", "capacityKg": 10, "rangeKm": 60, "speedKmh": 40 }
```

`name` e `speedKmh` são opcionais — o nome vira `Drone N` e a velocidade cai para 40.
</details>

### Pedidos

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/pedidos` | Registra um pedido de entrega |
| `GET` | `/pedidos` | Lista todos os pedidos |
| `GET` | `/pedidos/limites` | Limites vigentes, para o front validar antes de enviar |

<details>
<summary><code>POST /pedidos</code></summary>

```json
{ "location": { "x": 5, "y": 8 }, "weightKg": 3.5, "priority": "alta" }
```

- `400` — coordenada fora de `0..20`, fracionária ou não numérica; peso ≤ 0 ou com
  mais de 3 casas; prioridade fora do enum; campo desconhecido no payload.
- `422` — regra de negócio: zona de exclusão, destino inalcançável ou peso acima da frota.
</details>

### Zonas de exclusão

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/zonas` | Cria uma zona; as rotas passam a desviar dela |
| `GET` | `/zonas` | Lista as zonas ativas |
| `DELETE` | `/zonas/:id` | Remove uma zona (`204`) |

<details>
<summary><code>POST /zonas</code></summary>

```json
{ "name": "Centro", "minX": 3, "minY": 3, "maxX": 6, "maxY": 6 }
```

- `400` — retângulo invertido (`minX > maxX`) ou limites fora da malha.
- `422` — a zona cobre a base `(0,0)`.
</details>

### Entregas e simulação

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/entregas/rota` | Plano de alocação: viagens, rotas, custos e recusas com motivo |
| `GET` | `/entregas/simulacao` | Estado do relógio da simulação |
| `POST` | `/entregas/simulacao/pausar` | Congela o relógio |
| `POST` | `/entregas/simulacao/retomar` | Retoma o relógio |
| `POST` | `/entregas/simulacao/reiniciar` | Frota à base com bateria cheia, pedidos de volta à fila |

<details>
<summary><code>GET /entregas/rota</code> — formato da resposta</summary>

```jsonc
{
  "totalTrips": 2,
  "totalAssignedOrders": 7,
  "totalDistanceKm": 41.2,
  "totalTimeMinutes": 98.4,
  "makespanMinutes": 52.1,      // duração da viagem mais longa
  "trips": [
    {
      "id": "…",
      "drone": { "…": "…" },
      "orders": [ "…" ],
      "route": [ { "x": 5, "y": 8 } ],   // paradas na ordem de visita
      "path":  [ { "x": 0, "y": 0 } ],   // polilinha desviando das zonas
      "totalWeightKg": 8.5,
      "totalDistanceKm": 22.6,
      "detourKm": 1.4,                   // quanto o desvio custou vs. linha reta
      "occupancyPercent": 85,
      "batteryAfterPercent": 41.2
    }
  ],
  "unassigned": [
    { "order": { "…": "…" }, "reason": "Pacote de 12 kg acima da capacidade…" }
  ]
}
```
</details>

---

## Testes

Jest nativo do Nest, com desenvolvimento guiado por testes: as regras de alocação,
bateria e roteamento foram fechadas primeiro como especificação executável.

```bash
npm test           # 194 testes · 13 suítes
npm run test:cov   # + relatório de cobertura em coverage/
npm run test:e2e   #  14 testes · HTTP real via supertest
```

### Distribuição

| Suíte | Testes | Foco |
| --- | ---: | --- |
| `common/utils/geo.util.spec.ts` | 37 | A*, desvio de zonas, simplificação de rota, interpolação |
| `common/utils/flight.util.spec.ts` | 12 | Custo de tempo e bateria por viagem |
| `modules/deliveries/deliveries.service.spec.ts` | 24 | Planejador de alocação |
| `modules/deliveries/edge-cases.spec.ts` | 17 | **Edge cases** (detalhados abaixo) |
| `modules/deliveries/deliveries.load.spec.ts` | 18 | **Carga e simulação** (detalhados abaixo) |
| `modules/deliveries/simulation.service.spec.ts` | 12 | Relógio, fases de voo, recarga, reset |
| `modules/orders/orders.service.spec.ts` | 17 | Regras de registro e ciclo de vida |
| `modules/drones/drones.service.spec.ts` | 14 | Frota, disponibilidade, bateria |
| `modules/zones/zones.service.spec.ts` | 12 | Zonas de exclusão |
| DTOs (`*.form.spec.ts`, `*.response.spec.ts`) | 31 | Validação de entrada e serialização |
| `test/app.e2e-spec.ts` | 14 | Contrato HTTP e códigos de status |

### Cobertura

O domínio — onde mora a regra de negócio — está integralmente coberto:

| Arquivo | Stmts | Branch | Funcs |
| --- | ---: | ---: | ---: |
| `deliveries.service.ts` | 96% | 81% | 100% |
| `simulation.service.ts` | 97% | 87% | 100% |
| `orders.service.ts` | 100% | 100% | 100% |
| `drones.service.ts` | 100% | 100% | 100% |
| `zones.service.ts` | 100% | 100% | 100% |
| `geo.util.ts` | 99% | 95% | 100% |
| `flight.util.ts` | 100% | 100% | 100% |

Controllers e DTOs de resposta aparecem zerados no relatório de `npm run test:cov`
porque são exercitados pela suíte **e2e**, que roda em processo separado
(`test/jest-e2e.json`) e não alimenta o mesmo relatório.

### Testes de edge cases

`src/modules/deliveries/edge-cases.spec.ts` — três eixos, além dos limites já cobertos
nas suítes de cada service:

**Pacote acima da capacidade**

- Recusa quando o único drone que comporta o peso está em voo, informando a maior
  capacidade **disponível** (não a da frota inteira).
- Volta a alocar o mesmo pedido assim que aquele drone fica ocioso.
- Não estoura a capacidade somando pesos fracionários (aritmética de ponto flutuante).
- Deixa o excedente na fila com motivo, em vez de sobrecarregar o único drone.
- Recusa no registro (`422`) o pacote que nenhum drone da frota comporta.

**Drone sem carga suficiente**

- Despacha o drone parado exatamente no piso de bateria quando a viagem cabe na reserva.
- Segura o pedido quando a bateria cobre a ida mas não a reserva de retorno.
- Prefere o drone mais carregado entre dois de mesma capacidade.
- **Bateria zerada em voo**: aborta a viagem, devolve o pedido à fila (`pending`,
  sem drone), traz o drone à base e não contabiliza entrega.
- Não redespacha enquanto a carga está abaixo do piso de 20%.
- Recarrega na base e **reassume** o pedido devolvido pela viagem abortada.

**Coordenadas inválidas**

- Aceita destino na própria base como viagem de distância zero (caso degenerado).
- Recusa o canto da malha `(20,20)` quando a ida e volta estoura o alcance útil.
- Aceita o mesmo canto com um drone de alcance suficiente, com a distância batendo
  em `40√2`.
- Recusa destino fora da malha **no service**, sem depender do `ValidationPipe`
  (defesa em profundidade).
- Trata a borda da zona de exclusão como ponto proibido, e o ponto encostado como válido.
- Recusa destino cercado por zonas mesmo com a frota sobrando.

A validação de formato — coordenada negativa, acima da malha, fracionária, não numérica
e as bordas exatas `0` e `20` — vive em `create-order.form.spec.ts` e é reforçada com
`400` real na suíte e2e.

### Testes de carga e simulação

`src/modules/deliveries/deliveries.load.spec.ts` — verifica que a alocação continua
correta sob volume:

**Planejamento com fila grande** (60 pedidos / 6 drones)

- Nenhum pedido é perdido ou duplicado entre viagens e recusas.
- Capacidade, autonomia e reserva de bateria respeitadas em **todas** as viagens.
- No máximo uma viagem por drone; totais do plano coerentes com a soma das viagens.
- Replanejar sem mudanças produz alocação idêntica (determinismo).
- Prioridade alta nunca fica para trás enquanto sobra baixa.

**Pedidos simultâneos** (criação concorrente via `Promise.all`)

- 120 pedidos criados em paralelo: nenhum id colide, nenhum se perde.
- A alocação permanece íntegra com a fila montada em paralelo.
- Levas concorrentes intercaladas com replanejamento não alocam o mesmo pedido duas vezes.
- 200 pedidos / 12 drones: todas as restrições mantidas, dentro do orçamento de tempo.
- Chamadas concorrentes de `plan()` sobre a mesma fila produzem o mesmo plano.

**Simulação sob saturação** (relógio com fake timers)

- A fila inteira é entregue mantendo os invariantes **a cada tick**: carga por drone
  ≤ capacidade e bateria em `0..100`.
- Levas que chegam com a frota já em voo são absorvidas.
- Nenhum pedido fica em dois voos ao mesmo tempo, e nenhum pedido entregue volta ao
  estado anterior (monotonicidade das entregas).
- Cada pedido é entregue **exatamente uma vez**: `deliveriesCompleted` da frota bate
  com o total.
- Ao fim, toda a frota está de volta à base, sem viagem ativa e com a fila zerada.

### Helpers de teste

`src/testing/` concentra o que as suítes reaproveitam:

| Arquivo | Conteúdo |
| --- | --- |
| `test-context.ts` | Montagem do módulo Nest, fábricas (`addDrone`, `addOrder`, `addZone`), controle de ticks (`advanceTicks`, `runUntil`) e `pseudoRandom` com semente |
| `validation.ts` | `validateForm` / `expectNoErrors` para exercitar os DTOs isolados do HTTP |
| `jest.setup.ts` | Setup global da suíte |

Os cenários de carga usam um gerador pseudoaleatório **com semente fixa**, então a
suíte é determinística: mesma entrada, mesmo plano, a cada execução.
