# SKYGRID — Simulador de Entregas por Drone

Monorepo com a **API** (NestJS) e o **front de gerenciamento** (React + Vite).
Uma startup de logística está testando entregas por drones em áreas urbanas; o
sistema recebe pedidos, gerencia a frota e planeja rotas otimizadas sobre uma
malha 2D respeitando capacidade, alcance e prioridade.

## Estrutura

```
teste-dti-arthur/
├── backend/    API NestJS (MVC, Swagger, validação)
├── frontend/   Console React/Vite (mapa-radar, dashboard, fila)
└── package.json  orquestrador do monorepo
```

## Documentação

Este README é o panorama do monorepo. Cada projeto tem a sua documentação própria:

| Documento                                    | O que cobre                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [`backend/README.md`](backend/README.md)     | Stack, arquitetura MVC, modelo de domínio, regras de negócio, parâmetros da simulação, referência completa da API e testes |
| [`frontend/README.md`](frontend/README.md)   | Setup do React + TypeScript + Vite (template padrão do Vite)                                                              |

## Como rodar

Instale as dependências dos dois projetos:

```bash
npm run install:all
```

Suba API + front juntos:

```bash
npm run dev
```

Ou separados:

```bash
npm run dev:api   # http://localhost:3000  (Swagger em /docs)
npm run dev:web   # http://localhost:5173
```

O front lê a URL da API de `VITE_API_URL` (padrão `http://localhost:3000`).

## API — endpoints

| Método | Rota              | Descrição                                        |
| ------ | ----------------- | ------------------------------------------------ |
| POST   | `/pedidos`        | Registra um pedido (localização, peso, prioridade) |
| GET    | `/pedidos`        | Lista os pedidos                                  |
| POST   | `/drones`         | Cadastra um drone (capacidade, alcance)           |
| GET    | `/drones`         | Lista os drones                                   |
| GET    | `/drones/status`  | Status atual da frota                             |
| GET    | `/pedidos/limites`| Limites aceitos hoje (peso e alcance da frota)    |
| POST   | `/zonas`          | Cria uma zona de exclusão aérea                   |
| GET    | `/zonas`          | Lista as zonas de exclusão                        |
| DELETE | `/zonas/:id`      | Remove uma zona                                   |
| GET    | `/entregas/rota`  | Plano de alocação otimizado (viagens + rotas)     |
| GET    | `/entregas/simulacao` | Estado do relógio da simulação                |
| POST   | `/entregas/simulacao/pausar` \| `/retomar` \| `/reiniciar` | Controla a simulação |

## Arquitetura do backend

MVC modular, com interfaces, forms (entrada) e responses (Swagger) separados:

```
backend/src/
├── common/            enums, interfaces, utils (geometria da malha)
├── config/            Swagger
└── modules/
    ├── drones/        controller · service · dto/{forms,responses} · interfaces
    ├── orders/        idem  (rota /pedidos)
    ├── zones/         zonas de exclusão aérea (rota /zonas)
    └── deliveries/    alocação (/entregas/rota) + simulação em tempo real
```

O planejador usa uma **heurística gulosa em dois níveis**: First-Fit Decreasing para
montar as viagens — fila ordenada por prioridade e, dentro dela, por ordem de
chegada; drones percorridos da maior capacidade para a menor, para reduzir o número
de viagens — e **vizinho mais próximo** para ordenar as paradas da rota fechada
(base → entregas → base), respeitando peso, alcance e reserva de bateria. O desvio
das zonas de exclusão sai de um **A\*** sobre a malha.

Detalhamento do algoritmo, custo computacional e regras de negócio em
[`backend/README.md`](backend/README.md).

## Front — telas

- **Radar de operações**: malha 2D em SVG com base, clientes (por prioridade) e
  rotas do plano; passe o mouse num cliente para o feedback "a N quadras da base".
- **Novo pedido**: formulário com validação espelhando o backend.
- **Frota**: cards de drone com estado, capacidade, alcance e viagem atribuída.
- **Painel de eficiência**: métricas do plano (viagens, ocupação, distância, drone
  mais eficiente).
- **Fila de entregas**: pedidos ordenados por prioridade + tempo.
