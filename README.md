# SKYGRID — Simulador de Entregas por Drone

Monorepo com a **API** (NestJS) e o **front de gerenciamento** (React + Vite).
Uma startup de logística está testando entregas por drones em áreas urbanas; o
sistema recebe pedidos, gerencia a frota e planeja rotas otimizadas sobre uma
malha 2D respeitando capacidade, alcance e prioridade.

## Estrutura

```
teste-dti-arthur/
├── backend/            API NestJS (MVC, Swagger, validação) · Dockerfile · fly.toml
├── frontend/           Console React/Vite (mapa-radar, dashboard, fila) · Dockerfile · fly.toml
├── .github/workflows/  CI/CD — testes + deploy no Fly.io
└── package.json        orquestrador do monorepo
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

## Deploy

Os dois serviços rodam no **[Fly.io](https://fly.io)**, na região `gru` (São Paulo):

| Serviço  | URL                                                                              | App Fly                  |
| -------- | -------------------------------------------------------------------------------- | ------------------------ |
| Front    | **https://teste-dti-arthur-web.fly.dev/**                                        | `teste-dti-arthur-web`   |
| API      | https://teste-dti-arthur-api.fly.dev                                             | `teste-dti-arthur-api`   |
| Swagger  | https://teste-dti-arthur-api.fly.dev/docs                                        | —                        |

Cada projeto tem o seu `Dockerfile` e `fly.toml`: a API roda o build do Nest em Node 22
e o front é servido por nginx a partir do `dist` do Vite. A URL da API entra como
**build-arg** (`VITE_API_URL` em `frontend/fly.toml`), porque o Vite congela a URL no
bundle na hora do build — não é uma variável de runtime.

As duas máquinas ficam com `auto_stop_machines = false` e `min_machines_running = 1`:
a simulação vive em memória (`Map` nos services), então parar a máquina apagaria frota,
pedidos e zonas.

Deploy manual, se precisar:

```bash
fly deploy ./backend  --config backend/fly.toml
fly deploy ./frontend --config frontend/fly.toml
```

## CI/CD — GitHub Actions

O workflow [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) publica **todo push
na `main`** e também roda sob demanda (`workflow_dispatch`), o que permite publicar o
estado atual da `main` mesmo para commits que entraram antes do workflow existir.

Pipeline:

```
push na main ─┬─► api  (npm ci · lint · jest · e2e · nest build)
              └─► web  (npm ci · oxlint · tsc + vite build)
                        │
                        ├─► deploy-api  (fly deploy backend)
                        │        │
                        │        └─► deploy-web  (fly deploy frontend)
                        │
                        └─► smoke  (curl na API e no front)
```

- Em **pull request** para a `main` só os jobs de teste rodam — nada é publicado.
- `deploy-web` espera o `deploy-api` para o front recém-publicado já encontrar o
  backend novo.
- `concurrency` serializa os deploys: dois pushes seguidos não disputam a mesma máquina.

### Configuração necessária

Um único secret no repositório (**Settings → Secrets and variables → Actions**):

| Secret         | Como obter                                        |
| -------------- | ------------------------------------------------- |
| `FLY_API_TOKEN` | `fly tokens create deploy -a teste-dti-arthur-api` (ou um token de org com acesso aos dois apps) |

Um token de organização cobre os dois apps. Com tokens por app, gere um para cada
e ajuste os `env` dos jobs de deploy.

## API — endpoints

Rotas, payloads e valores de enum são todos em inglês — o padrão do projeto.

| Método | Rota                                                          | Descrição                                          |
| ------ | ------------------------------------------------------------- | -------------------------------------------------- |
| POST   | `/orders`                                                     | Registra um pedido (localização, peso, prioridade) |
| GET    | `/orders`                                                     | Lista os pedidos                                   |
| GET    | `/orders/limits`                                              | Limites aceitos hoje (peso e alcance da frota)     |
| POST   | `/drones`                                                     | Cadastra um drone (capacidade, alcance)            |
| GET    | `/drones`                                                     | Lista os drones                                    |
| GET    | `/drones/status`                                              | Status atual da frota                              |
| POST   | `/zones`                                                      | Cria uma zona de exclusão aérea                    |
| GET    | `/zones`                                                      | Lista as zonas de exclusão                         |
| DELETE | `/zones/:id`                                                  | Remove uma zona                                    |
| GET    | `/deliveries/route`                                           | Plano de alocação otimizado (viagens + rotas)      |
| GET    | `/deliveries/simulation`                                      | Estado do relógio da simulação                     |
| POST   | `/deliveries/simulation/pause` \| `/resume` \| `/reset`       | Controla a simulação                               |

`priority` aceita `low`, `medium` ou `high`.

## Arquitetura do backend

MVC modular, com interfaces, forms (entrada) e responses (Swagger) separados:

```
backend/src/
├── common/            enums, interfaces, utils (geometria da malha)
├── config/            Swagger
└── modules/
    ├── drones/        controller · service · dto/{forms,responses} · interfaces
    ├── orders/        idem  (rota /orders)
    ├── zones/         zonas de exclusão aérea (rota /zones)
    └── deliveries/    alocação (/deliveries/route) + simulação em tempo real
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
