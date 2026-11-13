# AI-LOG — registro do uso de IA

| | |
|---|---|
| Ferramenta | Claude Code, modelo **Claude Opus 5.5** (Anthropic) |
| Data | 12/11/2026 |
| O que a IA fez | Toda a implementação deste trabalho (servidor, banco, front, testes e documentação) |
| Autoria no git | Commits feitos pela IA têm o autor **`Claude (IA - Anthropic)`**. O commit `Projeto base` é o código que o aluno já tinha |
| Perguntas simuladas | A pedido do aluno, a IA escreveu perguntas **no papel dele**. Todas estão marcadas com 🤖 em [docs/ai-decisions.md](docs/ai-decisions.md) |

Este arquivo registra, em ordem, **o que o aluno realmente pediu** (mensagens reais, copiadas sem edição, exceto
a senha do banco) e o que a IA fez com cada pedido. A análise crítica de cada decisão (desafio → pergunta →
resposta bruta → crítica) está em [docs/ai-decisions.md](docs/ai-decisions.md).

---

## Prompt 1: pedido inicial (real, escrito pelo aluno)

Anexos: o PDF do enunciado ("Terceiro trabalho.pdf") e o "Texto complementar" do professor (FSM, conflitos
assíncronos e audit log).

> faça tudo aqui:  ~/Downloads/ppw2

**O que a IA fez:**
1. Leu o enunciado e identificou o projeto do aluno: **18. Delivery / Cozinha**, com a regra de alta complexidade
   "kan-ban com controle de tempo de preparo (lead time), itens adicionais/remoções e cancelamento durante
   produção" e o desafio "atualizações de status da cozinha em tempo real refletindo para o cliente sem
   polling agressivo".
2. Leu o código existente (`ppw_server` NestJS com banco em arquivo JSON e `ppw_client` Next.js) e encontrou os
   problemas que o enunciado pede para eliminar:
   - `PATCH /pedidos/:id/status` aceitava qualquer status (o `db.json` tinha um pedido que voltou de ENTREGUE para RECEBIDO);
   - `DELETE /pedidos/:id` apagava o pedido e a história junto;
   - `nextNumero()` com `max + 1` (número repetido em vendas simultâneas);
   - nenhuma noção de usuário, permissão, versão ou estoque;
   - a cozinha fazia polling a cada 5 s.
3. Fez um commit do código original no nome do aluno, para separar o que já existia do que a IA fez.
4. Implementou, em commits separados: banco PostgreSQL normalizado, máquina de estados com RBAC e guardas,
   casos de uso transacionais, API e testes, e o front.

## Prompt 2: conexão do laboratório (real)

> veja como é a conexao C:\Users\jovem Aprendiz\Downloads\ppw\ppw_server
>
> a conexao é assim: DATABASE_URL="postgresql://cocao:\*\*\*\*\*@10.102.55.11:5432/postgres?schema=bi3041409"

*(senha omitida neste arquivo)*

**O que a IA fez:** leu o `prisma.service.ts` do projeto `ppw` (Pool do `pg` + adaptador do Prisma com
`schema`). Como este projeto não usa Prisma, criou `separarSchema()`: tira o `?schema=` da URL, roda
`CREATE SCHEMA IF NOT EXISTS` e aplica `SET search_path` em cada conexão do pool. Passou a carregar o `.env`
com `dotenv`. O `.env` com a URL real **não é versionado**; o repositório tem só o `.env.example`.

## Prompt 3: (real)

> indo para faculdade vou testar a conexao, ai vc espera para testar dps, primeiro faça tudo

**O que a IA fez:** não tentou conectar no servidor do laboratório. Validou tudo com o PGlite (PostgreSQL
embutido): 11 testes de domínio, 12 testes e2e e um teste manual no navegador (lançar pedido, iniciar preparo,
cancelar com justificativa, histórico, página do cliente, evento SSE passando pelo proxy do Next).
A conexão com o laboratório foi testada depois, no Prompt 5.

## Prompt 4: transparência sobre o uso de IA (real)

> e preciso que vc simule perguntas (fingindo ser eu) para voce e que o professor saiba que é vc perguntando, além disso o deixe vc como autor nos commits, o professor precisa saber que eu usei ia

**O que a IA fez:**
- Reescreveu a autoria dos commits locais (ainda não enviados) para `Claude (IA - Anthropic)`. O commit do
  código original continua no nome do aluno.
- Escreveu [docs/ai-decisions.md](docs/ai-decisions.md) com 8 decisões no formato do enunciado. As perguntas são
  **simuladas pela IA** e marcadas com 🤖. A "resposta bruta" é a primeira resposta que a IA daria àquela
  pergunta isolada. A crítica explica o que estava errado e aponta o teste que comprova a correção.
- Separou, no fim daquele arquivo, os **erros reais** que a IA cometeu nesta sessão (pegos por testes ou pela
  execução).

## Prompt 5: teste no banco do laboratório (real)

> pode colocar a mão na massa, estou na instituição que libera a conexão com o banco

**O que a IA fez:**
1. Conectou no PostgreSQL do laboratório (versão 18.3) e conferiu, **antes de criar qualquer coisa**, que o
   schema `bi3041409` existia e estava vazio.
2. Subiu a API: as migrações criaram as 8 tabelas e a função do trigger dentro de `bi3041409`, e nada foi criado
   em `public`.
3. Pegou um erro próprio pelo log (aviso de depreciação do `pg`; ver erro nº 8 em `docs/ai-decisions.md`) e
   corrigiu.
4. Fez os testes e2e aceitarem `TEST_DATABASE_URL` e os rodou no servidor real, num schema descartável
   `bi3041409_teste` (apagado no fim): **12/12 passando** com transações concorrendo de verdade.
5. Testou o front ligado ao banco real: lançou o pedido #1 ("Cliente Teste Lab") pelo PDV e conferiu no banco o
   pedido, o histórico (autor Gabi, `CRIAR`) e a baixa de estoque (refrigerante 24 → 23).
   **Esse pedido de teste continua no schema `bi3041409`.**

---

## Resumo das refatorações

| Antes (código base) | Depois |
|---|---|
| `PATCH /status` com qualquer valor | `POST /pedidos/:id/acoes/:acao` + máquina de estados (6 ações, uma classe cada) |
| Sem usuários | 4 papéis, RBAC por estado, perfil no header com papel lido do banco |
| `DELETE /pedidos/:id` | Ação `CANCELAR` com justificativa e rollback parcial de estoque |
| `historico: [{status, data}]` dentro do JSON | Tabela `pedido_historico` append-only com autor, justificativa e detalhes, gravada na mesma transação |
| Arquivo JSON reescrito a cada operação | PostgreSQL com FK, CHECK, UNIQUE, SEQUENCE, trigger e migrações |
| Sem controle de concorrência | `FOR UPDATE` + versão (409) + `UPDATE` atômico de estoque + ordem fixa de locks |
| Polling de 5 s | Server-Sent Events, publicados só após o commit |
| Sem prazo | SLA por pedido, guarda de atraso e lead time por etapa (`LEAD()`) |
| 2 testes unitários em memória | 11 testes de domínio + 12 e2e em PostgreSQL real (PGlite) |

## O que o aluno precisa revisar antes da defesa
- [x] Testar com a `DATABASE_URL` do laboratório (feito no Prompt 5).
- [ ] Ler `docs/ai-decisions.md` e preencher os campos "Comentário do aluno".
- [ ] Conseguir explicar sem ajuda o fluxo da seção "Fluxo de uma requisição" do README e mudar ao vivo um
      dos parâmetros da tabela "Parâmetros fáceis de alterar".
