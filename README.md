# Delivery / Cozinha Industrial — Terceiro Trabalho Avaliativo

**Projeto 18 — Fluxo de Pedidos em Delivery / Cozinha Industrial**
Aluno: João Vitor Pereira Marques

> **Uso de IA:** a implementação deste trabalho foi feita com o assistente **Claude (Anthropic)**, a pedido do aluno.
> Os commits feitos pela IA estão com o autor `Claude (IA - Anthropic)`. Só o commit inicial, com o código que
> o aluno já tinha, está no nome dele. O registro completo está em [AI-LOG.md](AI-LOG.md) e em
> [docs/ai-decisions.md](docs/ai-decisions.md).

Um PDV lança pedidos, a cozinha os move num kanban, o entregador sai e confirma a entrega, e o cliente acompanha
tudo em tempo real. O status do pedido **não é um campo editável**: ele só muda por **ações** de uma máquina de
estados, com permissão por papel (RBAC), guardas de transição e trilha de auditoria gravada na mesma transação.

| Parte | Tecnologia |
|---|---|
| API (`ppw_server`) | NestJS 11 · Clean Architecture (domínio / aplicação / infraestrutura) |
| Banco | PostgreSQL (servidor do laboratório, Docker ou **PGlite**, um PostgreSQL embutido no Node) · SQL puro com `pg` |
| Front (`ppw_client`) | Next.js 16 · React 19 · Tailwind · Server-Sent Events |
| Testes | Jest: 11 testes de domínio + 12 testes e2e em PostgreSQL em memória |

---

## 1. Como rodar

Requisitos: **Node 22+**. Docker é opcional.

### API

```bash
cd ppw_server
npm install
cp .env.example .env      # edite a DATABASE_URL (ou apague a linha para usar o PGlite)
npm run start:dev         # http://localhost:8000
```

O banco é escolhido pela variável `DATABASE_URL`:

| `DATABASE_URL` | Banco usado |
|---|---|
| `postgresql://USUARIO:SENHA@10.102.55.11:5432/postgres?schema=SEU_RA` | PostgreSQL do laboratório, no schema indicado (mesmo formato do Prisma) |
| `postgresql://delivery:delivery@localhost:5432/delivery?schema=delivery` | PostgreSQL do `docker compose up -d` (arquivo na raiz) |
| *(não definida)* | PGlite gravando em `ppw_server/data/pglite`. Não precisa instalar nada |

Na subida, a API cria o schema (se não existir), aplica as migrações de `ppw_server/database/migrations/*.sql`
(controladas pela tabela `schema_migrations`) e, se o banco estiver vazio, roda `database/seed.sql`
(usuários, categorias e produtos de exemplo). `SEED=false` desliga o seed.

### Front

```bash
cd ppw_client
npm install
npm run dev               # http://localhost:3000  (/api/* é repassado para a porta 8000)
```

Não existe tela de login: o **seletor de perfil** no topo escolhe quem você é (Ana – atendente,
Carlos – cozinha, Edu/Bia – entregadores, Gabi – gerente). Troque de perfil para ver os botões mudarem.

### Testes

```bash
cd ppw_server
npm test            # domínio: máquina de estados, RBAC, guardas, rollback (sem banco)
npm run test:e2e    # API inteira + PostgreSQL em memória (PGlite): concorrência, ACID, auditoria
```

---

## 2. Máquina de estados

```mermaid
stateDiagram-v2
    [*] --> RECEBIDO: CRIAR (atendente/gerente)
    RECEBIDO --> EM_PREPARO: INICIAR_PREPARO
    EM_PREPARO --> PRONTO_PARA_RETIRADA: MARCAR_PRONTO
    PRONTO_PARA_RETIRADA --> EM_PREPARO: DEVOLVER_AO_PREPARO *
    PRONTO_PARA_RETIRADA --> EM_ROTA_DE_ENTREGA: DESPACHAR
    EM_ROTA_DE_ENTREGA --> ENTREGUE: CONFIRMAR_ENTREGA
    RECEBIDO --> CANCELADO: CANCELAR *
    EM_PREPARO --> CANCELADO: CANCELAR *
    PRONTO_PARA_RETIRADA --> CANCELADO: CANCELAR *
    EM_ROTA_DE_ENTREGA --> CANCELADO: CANCELAR *
    ENTREGUE --> [*]
    CANCELADO --> [*]
```
`*` = exige justificativa (mínimo 10 caracteres).

### Matriz de permissões (RBAC por estado)

| Ação | De → Para | Quem pode | Guarda de transição |
|---|---|---|---|
| `INICIAR_PREPARO` | RECEBIDO → EM_PREPARO | Cozinheiro, Gerente | Define o prazo (SLA) = maior tempo de preparo dos itens, mínimo 5 min |
| `MARCAR_PRONTO` | EM_PREPARO → PRONTO | Cozinheiro, Gerente | **Se o SLA estourou, exige justificativa do atraso** |
| `DEVOLVER_AO_PREPARO` | PRONTO → EM_PREPARO | Cozinheiro, Gerente | Justificativa obrigatória |
| `DESPACHAR` | PRONTO → EM_ROTA | Entregador | **No máximo 3 pedidos em rota por entregador** (consulta cruzada, com lock) |
| `CONFIRMAR_ENTREGA` | EM_ROTA → ENTREGUE | O entregador **daquele** pedido, Gerente | — |
| `CANCELAR` | RECEBIDO → CANCELADO | Atendente, Gerente | Justificativa obrigatória |
| `CANCELAR` | EM_PREPARO / PRONTO / EM_ROTA → CANCELADO | **Só Gerente** | Justificativa obrigatória + rollback parcial (abaixo) |
| Alterar itens/dados (`PUT`) | não muda status | Atendente, Gerente | Só em RECEBIDO ou EM_PREPARO. Em preparo, exige justificativa |
| Cadastro de produtos / estoque | — | Gerente | Estoque só por ajuste relativo (+/−) |

A tabela também é exposta em `GET /pedidos/maquina-estados` e cada pedido traz `acoesDisponiveis`
(as ações que o perfil atual pode executar). O front só desenha esses botões, mas quem bloqueia é o backend.

### Respostas de erro

| Situação | HTTP |
|---|---|
| Campo inválido, ação desconhecida, sem `versao` | 400 |
| Sem perfil (`X-Usuario-Id`) ou perfil inexistente | 401 |
| Papel não pode executar a ação nesse estado | 403 |
| Pedido/produto não encontrado | 404 |
| **Versão desatualizada** (outra pessoa alterou antes) ou **estoque insuficiente** | 409 |
| Transição inválida (ex.: entregar um pedido RECEBIDO), guarda não cumprida, `status` enviado no `PUT` | 422 |
| Violação de constraint do banco que escapou do código (CHECK, FK, UNIQUE) | 409 / 422 |

---

## 3. Modelo de dados (DER)

```mermaid
erDiagram
    USUARIOS ||--o{ PEDIDOS : "cria (criado_por_id)"
    USUARIOS ||--o{ PEDIDOS : "entrega (entregador_id)"
    USUARIOS ||--o{ PEDIDO_HISTORICO : "autor"
    USUARIOS ||--o{ MOVIMENTACOES_ESTOQUE : "autor"
    CATEGORIAS ||--o{ PRODUTOS : "agrupa"
    PEDIDOS ||--|{ ITENS_PEDIDO : "contém"
    PRODUTOS ||--o{ ITENS_PEDIDO : "vendido em"
    PEDIDOS ||--|{ PEDIDO_HISTORICO : "trilha"
    PRODUTOS ||--o{ MOVIMENTACOES_ESTOQUE : "movimenta"
    PEDIDOS ||--o{ MOVIMENTACOES_ESTOQUE : "origina"

    USUARIOS {
        uuid id PK
        text nome
        text papel "CHECK ATENDENTE|COZINHEIRO|ENTREGADOR|GERENTE"
        boolean ativo
    }
    CATEGORIAS {
        serial id PK
        text nome UK
    }
    PRODUTOS {
        uuid id PK
        int categoria_id FK
        text nome
        numeric preco "CHECK > 0"
        int tempo_preparo_min "CHECK 0..240"
        int estoque "NULL = feito na hora; CHECK >= 0"
        boolean ativo "exclusão lógica"
    }
    PEDIDOS {
        uuid id PK
        int numero UK "SEQUENCE"
        text cliente
        text endereco
        text status "CHECK nos 6 estados"
        int versao "bloqueio otimista"
        uuid criado_por_id FK
        uuid entregador_id FK "obrigatório em rota/entregue"
        timestamptz prazo_preparo_em "SLA"
        numeric valor_perda "CHECK >= 0"
    }
    ITENS_PEDIDO {
        uuid pedido_id PK,FK
        uuid produto_id PK,FK
        text nome_produto "cópia do momento da venda"
        numeric preco_unitario "cópia do momento da venda"
        int quantidade "CHECK > 0"
        int tempo_preparo_min
        boolean reserva_estoque
    }
    PEDIDO_HISTORICO {
        bigserial id PK
        uuid pedido_id FK
        text acao
        text estado_anterior "NULL só em CRIAR"
        text novo_estado
        uuid autor_id FK
        text justificativa
        jsonb detalhes
        timestamptz criado_em
    }
    MOVIMENTACOES_ESTOQUE {
        bigserial id PK
        uuid produto_id FK
        uuid pedido_id FK
        text tipo "RESERVA|DEVOLUCAO|AJUSTE"
        int quantidade "≠ 0"
        int saldo_apos "CHECK >= 0"
        uuid autor_id FK
        text motivo
    }
```

Decisões de modelagem:
- **Categoria normalizada** em tabela própria (antes era texto repetido em cada produto).
- `itens_pedido` copia nome, preço e tempo de preparo do produto. Não é redundância acidental: é o
  **histórico de preço**. Mudar o cardápio não altera pedidos antigos.
- Chave primária composta `(pedido_id, produto_id)`: o mesmo produto não aparece duas vezes no pedido.
- Todas as FKs são `ON DELETE RESTRICT`. Pedido não é apagado (vira `CANCELADO`) e produto sai do
  cardápio por exclusão lógica (`ativo = false`).
- `pedido_historico` e `movimentacoes_estoque` são **append-only**: um trigger recusa `UPDATE` e `DELETE`.
- CHECKs de coerência entre colunas: pedido em rota precisa de entregador; pedido em preparo precisa de prazo.

Script completo: [`ppw_server/database/migrations/001_schema.sql`](ppw_server/database/migrations/001_schema.sql).

---

## 4. Regras de negócio complexas

### 4.1 Concorrência

| Problema | Solução | Onde |
|---|---|---|
| Cozinheiro clica "Iniciar preparo" enquanto a atendente cancela o mesmo pedido | `SELECT ... FOR UPDATE` + **versão** enviada pelo cliente. Quem chega depois recebe **409** e a tela recarrega | `executar-acao-pedido.use-case.ts`, `pg-pedido.repository.ts` |
| Duas vendas levam o último pudim | `UPDATE produtos SET estoque = estoque - $2 WHERE id = $1 AND estoque >= $2`, verificando e baixando no mesmo comando. Uma das vendas recebe 409 e faz rollback de tudo | `pg-estoque.repository.ts` |
| Dois pedidos recebem o mesmo número | `SEQUENCE` no lugar de `max(numero) + 1` | `001_schema.sql` |
| Entregador despacha 2 pedidos ao mesmo tempo e passa do limite de 3 | A guarda trava a linha do entregador (`FOR UPDATE`) antes de contar | `pg-pedido.repository.ts → contarEntregasEmRota` |
| Deadlock entre duas vendas com os mesmos produtos | Reservas sempre na mesma ordem (`produtoId`) | `create-pedido.use-case.ts` |
| Gerente edita o estoque enquanto vende | O `PUT` do produto **não grava estoque**. Estoque só muda por ajuste relativo `+/-` | `update-produto.use-case.ts`, `POST /produtos/:id/estoque` |

### 4.2 SLA e temporalidade
- Ao iniciar o preparo: `prazo = agora + max(tempo de preparo dos itens)` (mínimo 5 min).
- O kanban mostra um cronômetro ("faltam 12 min" / "atrasado 3 min") e destaca os atrasados.
- **Guarda temporal:** depois do prazo, `MARCAR_PRONTO` exige justificativa do atraso. A regra é avaliada no
  servidor na hora da ação, sem depender de cron.
- Um adicional durante o preparo pode **empurrar** o prazo, mas nunca antecipá-lo.
- **Lead time por etapa** (`GET /pedidos/metricas/lead-time`): calculado da trilha de auditoria com a função
  de janela `LEAD()`, que mede o tempo entre entrar e sair de cada coluna.

### 4.3 Rollback / cancelamento parcial
| Cancelado em | O que volta ao estoque | O que vira perda (`valor_perda`) |
|---|---|---|
| RECEBIDO | Tudo que baixou estoque | Nada |
| EM_PREPARO / PRONTO | Itens lacrados (lata, sobremesa pronta) | Pratos feitos na hora |
| EM_ROTA | Nada (já saiu da loja) | O pedido inteiro |

**Adicionais e remoções** (`PUT /pedidos/:id`, só em RECEBIDO/EM_PREPARO): a diferença entre os itens antigos e os
novos gera reservas (item novo ou mais quantidade) e devoluções (item removido). Prato removido durante o preparo
vira perda. Tudo vai para o histórico com o "antes" e o "depois".

### 4.4 Auditoria (Audit Log)
Toda escrita em pedido (criar, alterar, cada ação) insere em `pedido_historico`
(`pedido_id, estado_anterior, novo_estado, autor_id, justificativa, detalhes, criado_em`) **na mesma transação**
do `UPDATE`. Se algo falhar, o histórico também sofre rollback, e nunca existe histórico de algo que não
aconteceu nem mudança sem histórico. O trigger impede reescrever o passado, até para quem tem acesso direto ao banco.

### 4.5 Tempo real sem polling
`GET /pedidos/eventos` (Server-Sent Events): uma conexão HTTP fica aberta e o servidor empurra um aviso a cada
mudança, **só depois do commit**. O evento diz apenas *qual* pedido mudou; o front busca os dados com o
próprio perfil (as ações disponíveis dependem de quem está vendo). O cliente final usa
`GET /acompanhamento/:id/eventos`, que filtra só o pedido dele. O `EventSource` reconecta sozinho e, ao
reconectar, a tela recarrega o que perdeu.

---

## 5. Arquitetura e SOLID

```
ppw_server/src
├── domain/                     regras puras, sem Nest e sem SQL
│   ├── entities/               Pedido (sem setter de status), Produto, Usuario
│   ├── state-machine/
│   │   ├── acao-pedido.ts      classe base (Template Method)
│   │   ├── acoes/*.acao.ts     uma classe por ação
│   │   └── maquina-estados-pedido.ts
│   ├── services/politica-alteracao-pedido.ts   adicionais/remoções
│   └── repositories/           contratos (classes abstratas)
├── application/
│   ├── ports/                  UnitOfWork (transação), PublicadorEventos (Observer)
│   └── use-cases/              um caso de uso por operação
└── infrastructure/
    ├── database/postgres/      SQL, Unit of Work, migrações, PGlite/pg
    ├── events/                 barramento RxJS (Observer)
    └── http/                   controllers, guard de perfil, filtro de erros, presenters
```

- **OCP:** `MaquinaEstadosPedido` não tem `if/switch` por ação. Ela procura a ação pelo nome e delega. Uma
  ação nova (ex.: "reabrir pedido") é uma classe nova registrada em `criarMaquinaEstadosPedido()`. O teste
  "é aberta para extensão" prova isso.
- **SRP:** cada ação conhece só a própria regra; a máquina só despacha; o caso de uso só orquestra a
  transação; o repositório só faz SQL; o presenter só formata JSON.
- **LSP:** `AcaoPedido.validar()` e `aplicar()` têm ordem fixa (origem → permissão → justificativa → guarda →
  efeitos). As subclasses só preenchem ganchos e nunca enfraquecem as verificações, então qualquer ação pode
  substituir outra na máquina.
- **DIP:** casos de uso dependem de `UnitOfWork`/`PedidoRepository` (abstrações). Trocar PGlite por
  PostgreSQL não mexe no domínio.

### Fluxo de uma requisição (exemplo para a defesa)

`POST /pedidos/:id/acoes/cancelar` com `{ "versao": 2, "justificativa": "Cliente desistiu" }` e `X-Usuario-Id` do gerente:

1. `AutenticacaoGuard`: `SELECT id, nome, papel, ativo FROM usuarios WHERE id = $1`. O papel vem do banco.
2. `PedidosController.acao` → `ExecutarAcaoPedidoUseCase.execute`
3. `BEGIN`
4. `SELECT ... FROM pedidos WHERE id = $1 FOR UPDATE` + `SELECT * FROM itens_pedido WHERE pedido_id = ANY($1)`
5. versão do banco ≠ 2 → **409** (`ROLLBACK`)
6. `CancelarAcao.validar`: estado de origem (422) → papel no estado (403) → justificativa (422)
7. `CancelarAcao.aplicar`: calcula devoluções e perda e muda o status em memória
8. Para cada item lacrado: `UPDATE produtos SET estoque = estoque + $2 ... RETURNING estoque` + `INSERT INTO movimentacoes_estoque`
9. `UPDATE pedidos SET ..., versao = versao + 1 WHERE id = $1 AND versao = $2`. Se 0 linhas, **409**
10. `DELETE/INSERT itens_pedido` + `INSERT INTO pedido_historico (...)`
11. `COMMIT` → `PublicadorEventos.publicar(...)` → SSE para a cozinha e o cliente
12. `PedidoPresenter` devolve o pedido com `versao: 3` e as novas `acoesDisponiveis`

### Parâmetros fáceis de alterar ao vivo

| O que | Onde |
|---|---|
| Limite de entregas simultâneas (3) | `domain/state-machine/acoes/despachar.acao.ts` → `LIMITE_ENTREGAS_SIMULTANEAS` |
| SLA mínimo (5 min) | `acoes/iniciar-preparo.acao.ts` → `PRAZO_MINIMO_MIN` |
| Tamanho mínimo da justificativa (10) | `state-machine/acao-pedido.ts` → `JUSTIFICATIVA_MINIMA` |
| Quem pode cada ação | `papeis` / `papeisPara()` de cada classe em `acoes/` |
| Em quais status dá para alterar itens | `services/politica-alteracao-pedido.ts` → `STATUS_QUE_PERMITEM_ALTERACAO` |
| Nova ação no fluxo | nova classe em `acoes/` + uma linha em `criarMaquinaEstadosPedido()` |

---

## 6. API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/usuarios` | Perfis para o seletor (público) |
| GET | `/produtos` · `/produtos/:id` | Cardápio (público) |
| POST / PUT / DELETE | `/produtos[/:id]` | Gerente: cadastrar, alterar, tirar do cardápio |
| POST | `/produtos/:id/estoque` | Gerente: ajuste relativo `{ delta, motivo }` |
| GET | `/pedidos?status=` | Lista com `acoesDisponiveis` do perfil |
| GET | `/pedidos/:id` · `/pedidos/:id/historico` | Detalhe e trilha de auditoria |
| POST | `/pedidos` | Lançar pedido (atendente/gerente) |
| PUT | `/pedidos/:id` | Adicionais/remoções `{ ..., itens, versao, justificativa? }`. **Não aceita `status`** |
| POST | `/pedidos/:id/acoes/:acao` | `iniciar-preparo`, `marcar-pronto`, `devolver-ao-preparo`, `despachar`, `confirmar-entrega`, `cancelar` · corpo `{ versao, justificativa? }` |
| GET | `/pedidos/maquina-estados` | Tabela de transições e papéis |
| GET | `/pedidos/metricas/lead-time` | Tempo médio por etapa |
| GET (SSE) | `/pedidos/eventos` | Eventos de todos os pedidos |
| GET · GET (SSE) | `/acompanhamento/:id` · `/acompanhamento/:id/eventos` | Visão pública do cliente |

Os antigos `PATCH /pedidos/:id/status` e `DELETE /pedidos/:id` **foram removidos de propósito**.

---

## 7. Limitações conhecidas
- **Identificação simplificada:** o perfil vai no header `X-Usuario-Id`, sem senha. O papel é lido do banco,
  então ninguém se promove trocando o JSON, mas qualquer pessoa pode escolher outro perfil. Em produção seria
  um JWT; a regra de RBAC não muda.
- **PGlite tem uma conexão só:** as transações ficam em fila, então os testes de concorrência provam o
  comportamento (uma vence, a outra recebe 409), mas não a disputa real de locks. No PostgreSQL do
  laboratório as transações rodam em paralelo, e é aí que o `FOR UPDATE` e o `WHERE versao = $n` trabalham.
- **SSE em memória:** o barramento (RxJS) vale para uma instância do servidor. Com várias réplicas, ele seria
  trocado por `LISTEN/NOTIFY` do PostgreSQL ou Redis, sem mexer nos casos de uso.
- O eslint dos dois projetos já estava com erro de configuração antes deste trabalho e não foi alterado.
