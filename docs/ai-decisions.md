# Decisões tomadas com IA (docs/ai-decisions.md)

> **Leia primeiro: quem escreveu o quê**
>
> - Ferramenta: **Claude (modelo Claude Opus 5.5, Anthropic)**, usado no Claude Code.
> - O aluno pediu à IA que implementasse o trabalho inteiro e que **simulasse as perguntas que ele faria**,
>   deixando claro ao professor que as perguntas foram escritas pela IA.
> - Por isso, em cada decisão abaixo:
>   - **🤖 Pergunta (simulada pela IA no papel do aluno):** texto escrito pela IA, imitando o que o aluno perguntaria.
>   - **🤖 Resposta bruta da IA:** a primeira resposta que a IA dá para aquela pergunta isolada, sem o contexto do
>     projeto, que é o tipo de resposta que alguém recebe ao perguntar direto. Ela fica registrada para mostrar o
>     que estava errado ou incompleto.
>   - **🤖 Crítica e refatoração:** também escrita pela IA. Explica o que a resposta bruta errou, o que foi
>     implementado no lugar e qual teste comprova.
> - Os erros **reais** que a IA cometeu durante a implementação (e que os testes ou a execução pegaram) estão
>   separados na última seção.
> - Espaço do aluno: no fim de cada decisão há um campo para o aluno registrar com as próprias palavras se
>   concorda com a crítica.

---

## D1. Modelagem da máquina de estados

**Desafio:** o sistema antigo tinha `PATCH /pedidos/:id/status { status }` e um `<select>` de status no
formulário. Qualquer status podia virar qualquer outro (no banco havia um pedido que foi de ENTREGUE para
EM_ROTA e depois para RECEBIDO).

**🤖 Pergunta (simulada pela IA no papel do aluno):**
> "Tenho um sistema de delivery em NestJS onde o status do pedido é alterado por um PATCH. Como eu faço uma
> máquina de estados para impedir transições inválidas?"

**🤖 Resposta bruta da IA:**
> Crie um mapa de transições permitidas e valide no serviço:
> ```ts
> const TRANSICOES = {
>   RECEBIDO: ['EM_PREPARO', 'CANCELADO'],
>   EM_PREPARO: ['PRONTO_PARA_RETIRADA', 'CANCELADO'],
>   PRONTO_PARA_RETIRADA: ['EM_ROTA_DE_ENTREGA'],
>   EM_ROTA_DE_ENTREGA: ['ENTREGUE'],
> };
> async updateStatus(id: string, novo: string) {
>   const pedido = await this.repo.findById(id);
>   if (!TRANSICOES[pedido.status]?.includes(novo)) {
>     throw new BadRequestException('Transição inválida');
>   }
>   pedido.status = novo;
>   return this.repo.save(pedido);
> }
> ```

**🤖 Crítica e refatoração:**
1. **Continua sendo "mandar o status".** O cliente diz o *destino*, não o *evento*. O enunciado pede
   transições orientadas a ações (`aprovar()`, `cancelar()`). Agora existe `POST /pedidos/:id/acoes/:acao`, e o
   `PUT` recusa o campo `status` com 422.
2. **Sem RBAC.** No mapa, quem pode o quê não aparece. Cancelar em RECEBIDO é permitido ao atendente, mas em
   EM_PREPARO só ao gerente. Isso virou `papeisPara(status)` em cada ação.
3. **Sem guardas.** Não dá para expressar "justificativa obrigatória", "SLA estourado" ou "limite de 3
   entregas". Cada ação tem o gancho `guarda()`.
4. **Sem efeitos.** Cancelar precisa devolver estoque e calcular perda; iniciar preparo precisa definir o prazo.
5. **HTTP errado:** 400 significa requisição mal formada. Transição proibida pela regra é **422**, e falta de
   permissão é **403**.
6. **OCP:** o mapa e o serviço crescem a cada regra nova. Na solução final, cada ação é uma classe (`acoes/*.acao.ts`),
   a máquina só delega e uma ação nova não altera código existente.
7. **Sem auditoria:** `pedido.status = novo; save()` sobrescreve o passado.

Testes: `maquina-estados-pedido.spec.ts` (11 casos, incluindo "é aberta para extensão (OCP)") e o e2e
"não aceita status por formulário".

*Comentário do aluno:* ______________________________________________

---

## D2. Tempo real sem polling (desafio da matriz para o projeto 18)

**🤖 Pergunta (simulada pela IA no papel do aluno), a mesma do enunciado:**
> "Como estruturar atualizações de status da cozinha em tempo real refletindo para o cliente sem pooling agressivo?"

**🤖 Resposta bruta da IA:**
> Use WebSockets com `@nestjs/websockets` e Socket.IO. Crie um `PedidosGateway` e, no serviço, depois de
> alterar o status, chame `this.gateway.server.emit('pedidoAtualizado', pedido)`. No front, conecte com
> `socket.io-client` e atualize o estado quando receber o evento.

**🤖 Crítica e refatoração:**
1. **Evento antes do commit:** se o `emit` roda dentro do serviço e a transação falha depois, todos recebem uma
   mudança que não aconteceu. Na solução, o `PublicadorEventos.publicar` só é chamado **depois** de
   `uow.executar()` retornar. O teste e2e "publica evento só depois do commit" prova que um 403 não gera evento.
2. **Vazamento de dados:** fazer `emit` do pedido inteiro para *todos* manda endereço e telefone de qualquer
   cliente para qualquer navegador conectado. Além disso, `acoesDisponiveis` depende de *quem* está vendo. A
   solução manda só `{ pedidoId, status, versao }` e cada tela busca os dados com o próprio perfil.
   O cliente final tem um stream filtrado (`/acompanhamento/:id/eventos`) e uma visão reduzida, sem endereço.
3. **Ferramenta maior que o problema:** o fluxo é só servidor → navegador. Server-Sent Events é HTTP comum,
   passa pelo proxy do Next sem configuração (testado), e o `EventSource` reconecta sozinho, sem dependência nova.
4. **Reconexão:** a resposta bruta não trata o que acontece com os eventos perdidos enquanto a conexão cai. O hook
   `useEventosPedidos` recarrega a tela no `onopen` após uma queda.
5. **Limitação assumida:** o barramento RxJS é em memória (uma instância). Com várias réplicas seria `LISTEN/NOTIFY`.

*Comentário do aluno:* ______________________________________________

---

## D3. Conflito entre cozinha e atendente no mesmo pedido

**🤖 Pergunta (simulada pela IA no papel do aluno):**
> "Se o cozinheiro clicar em 'iniciar preparo' no mesmo segundo em que a atendente cancela o pedido, o que
> acontece? Basta colocar tudo numa transação?"

**🤖 Resposta bruta da IA:**
> Sim. Envolva a operação em uma transação: dentro dela leia o pedido, valide o status e faça o UPDATE. Como a
> transação é atômica, não haverá inconsistência.

**🤖 Crítica e refatoração:**
1. **Atomicidade não é isolamento.** No READ COMMITTED (padrão do PostgreSQL), as duas transações leem
   `RECEBIDO` ao mesmo tempo, as duas passam na validação e a segunda sobrescreve a primeira (*lost update*).
   Correção: `SELECT ... FOR UPDATE` faz a segunda transação esperar e reler o pedido já alterado.
2. **A decisão foi tomada numa tela velha.** Mesmo com o lock, se a atendente estava olhando a versão 1 e o
   pedido já está na versão 2, ela decidiu cancelar sem saber que o preparo começou. Correção: **bloqueio
   otimista**. O cliente envia a `versao` que está vendo, o servidor compara e o
   `UPDATE ... WHERE versao = $n` é a segunda barreira. Resposta: **409** e a tela recarrega.
3. Teste e2e "concorrência: duas ações simultâneas na mesma versão": com `Promise.all`, uma requisição recebe 200 e
   a outra 409, e o histórico tem exatamente uma transição.

*Comentário do aluno:* ______________________________________________

---

## D4. Baixa de estoque concorrente

**🤖 Pergunta (simulada pela IA no papel do aluno):**
> "Bebidas e sobremesas têm estoque. Como faço a baixa quando o pedido é criado?"

**🤖 Resposta bruta da IA:**
> ```ts
> const produto = await this.produtoRepo.findById(item.produtoId);
> if (produto.estoque < item.quantidade) throw new BadRequestException('Sem estoque');
> produto.estoque -= item.quantidade;
> await this.produtoRepo.save(produto);
> ```

**🤖 Crítica e refatoração:**
1. **Janela entre ler e gravar:** duas vendas leem `estoque = 1`, as duas passam no `if` e as duas gravam `0`. O
   mesmo pudim foi vendido duas vezes. Correção: verificar e baixar **no mesmo comando**
   `UPDATE produtos SET estoque = estoque - $2 WHERE id = $1 AND estoque >= $2 RETURNING estoque`. Zero linhas
   afetadas significa sem estoque (409). Além disso, `CHECK (estoque >= 0)` no banco.
2. **Atomicidade do pedido:** se o 2º item não tem estoque, a baixa do 1º precisa ser desfeita. Tudo roda no
   mesmo Unit of Work. Teste: "se um item não tem estoque, nada do pedido é gravado".
3. **Deadlock:** a venda A trava refri e depois pudim, a venda B trava pudim e depois refri. As reservas agora
   são feitas em ordem de `produtoId`.
4. **O mesmo bug no cadastro:** o formulário de produto gravava o estoque digitado, apagando vendas feitas
   enquanto o gerente editava. O `PUT` não grava mais estoque, e existe um ajuste relativo (`delta`).
5. **Rastreabilidade:** cada movimento vai para `movimentacoes_estoque` com `saldo_apos`.
6. Teste e2e: 5 vendas simultâneas de pudim com estoque 3 resultam em 3 × 201, 2 × 409 e estoque final 0.

*Comentário do aluno:* ______________________________________________

---

## D5. Número sequencial do pedido

**🤖 Pergunta (simulada pela IA no papel do aluno):**
> "O código atual calcula o número do pedido com o maior número + 1. Posso manter isso no PostgreSQL se
> estiver dentro da transação?"

**🤖 Resposta bruta da IA:**
> Pode. Dentro de uma transação, `SELECT max(numero) + 1 FROM pedidos` seguido do INSERT é seguro.

**🤖 Crítica e refatoração:**
Não é seguro: duas transações concorrentes leem o mesmo `max` (uma não enxerga o INSERT ainda não commitado da
outra) e geram números repetidos. Com `UNIQUE`, uma delas falha à toa; sem `UNIQUE`, ficam dois pedidos #42.
Correção: `CREATE SEQUENCE pedidos_numero_seq` + `numero ... UNIQUE DEFAULT nextval(...)`. A sequence não é
transacional e nunca repete (pode pular números em rollback, o que é aceitável para um número de exibição).
O teste das 5 vendas simultâneas confere que os números são distintos.

*Comentário do aluno:* ______________________________________________

---

## D6. Cancelamento durante a produção (rollback parcial)

**🤖 Pergunta (simulada pela IA no papel do aluno):**
> "O que o sistema deve fazer quando um pedido é cancelado no meio do fluxo?"

**🤖 Resposta bruta da IA:**
> Ao cancelar, devolva todos os itens ao estoque e mude o status para CANCELADO. Se quiser, registre a data do
> cancelamento.

**🤖 Crítica e refatoração:**
1. **Um prato que já foi para o fogo não volta ao estoque.** E a maior parte dos itens (marmitas) nem tem
   estoque. A solução distingue o item que **baixou estoque** (`reserva_estoque`, gravado na venda) do item
   feito na hora.
2. **O momento importa:** em RECEBIDO tudo volta; em preparo/pronto, só o lacrado volta e os pratos viram
   `valor_perda`; em rota nada volta. Ver `cancelar.acao.ts`.
3. **Quem pode cancelar também depende do momento:** atendente só antes da produção.
4. **Justificativa obrigatória** e detalhes (o que voltou, o que foi perdido) gravados no histórico em JSONB.
5. A mesma lógica vale para **remoções** de item durante o preparo (`politica-alteracao-pedido.ts`).

*Comentário do aluno:* ______________________________________________

---

## D7. Trilha de auditoria

**🤖 Pergunta (simulada pela IA no papel do aluno):**
> "Preciso guardar o histórico de alterações de status. Qual a melhor forma no PostgreSQL?"

**🤖 Resposta bruta da IA:**
> Crie um trigger `AFTER UPDATE` em `pedidos` que insere `OLD.status`, `NEW.status` e `now()` numa tabela de
> log. Assim nenhum código esquece de registrar.

**🤖 Crítica e refatoração:**
1. **O trigger não sabe quem fez nem por quê.** A conexão do banco é a mesma para todos os usuários da
   aplicação, e o `autor_id` e a `justificativa` que o enunciado exige só existem na aplicação. A inserção agora é
   feita pelo caso de uso **na mesma transação** do UPDATE.
2. **`now()` é o mesmo instante para a transação inteira.** Foi usado `clock_timestamp()` no default.
3. **O trigger ficou, mas com outro papel:** em vez de *escrever* o log, ele **impede `UPDATE`/`DELETE`** em
   `pedido_historico` e `movimentacoes_estoque` (append-only). Teste e2e: "a trilha de auditoria é imutável
   no próprio banco".
4. CHECK `(acao = 'CRIAR') = (estado_anterior IS NULL)`: só a criação não tem estado anterior.

*Comentário do aluno:* ______________________________________________

---

## D8. Lead time por etapa

**🤖 Pergunta (simulada pela IA no papel do aluno):**
> "Como calculo quanto tempo os pedidos ficam em cada coluna do kanban usando o histórico?"

**🤖 Resposta bruta da IA:**
> Faça um self-join: para cada registro `h1` com `novo_estado = X`, procure `h2` do mesmo pedido com
> `estado_anterior = X` e calcule `h2.criado_em - h1.criado_em`.

**🤖 Crítica e refatoração:**
Com `DEVOLVER_AO_PREPARO`, um pedido passa **duas vezes** por EM_PREPARO. O self-join por status cruza a 1ª
entrada com a 2ª saída e gera tempos duplicados e errados. Correção: função de janela
`LEAD(criado_em) OVER (PARTITION BY pedido_id ORDER BY id)`, que pega a próxima linha do mesmo pedido,
ignorando registros `ALTERAR` (que não mudam a etapa). Ver `pg-historico.repository.ts → leadTimePorEtapa`.
O teste e2e do fluxo completo passa por esse caso.

*Comentário do aluno:* ______________________________________________

---

## Erros reais cometidos pela IA durante a implementação

Estes não são simulados: aconteceram nesta sessão e foram pegos ao rodar os testes ou o sistema.

| # | Erro da IA | Como apareceu | Correção |
|---|---|---|---|
| 1 | Testes e2e esperavam total R$ 56,00 e perda R$ 50,00, supondo marmita a R$ 25 | A IA percebeu antes de rodar que o seed usa R$ 24,90 | Valores corrigidos para 55,80 / 49,80 / 24,90 |
| 2 | Jest não carregava o PGlite (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`) | 1ª execução do `test:e2e` | Scripts `test` e `test:e2e` rodam o Jest com `--experimental-vm-modules` e `--runInBand` |
| 3 | `PGlite` não cria pastas intermediárias, então a API não subia num clone novo (`ENOENT mkdir data/pglite`) | 1ª vez que a API foi iniciada fora dos testes | `mkdirSync(dataDir, { recursive: true })` em `PgliteDatabase.abrir` |
| 4 | O schema começava com `CREATE EXTENSION pgcrypto`, desnecessário (o `gen_random_uuid()` é nativo desde o PG 13) e que poderia falhar no PGlite e em servidores sem permissão para extensões | Revisão do script antes do 1º teste | Linha removida |
| 5 | Os nomes do seed já tinham o papel ("Gabi (Gerente)"), então a tela mostrava "Gabi (Gerente) (Gerente)" | Teste manual no navegador | Seed com nomes simples |
| 6 | O toast mostrava o verbo ("Pedido #1: cancelar pedido") | Teste manual no navegador | Usa o particípio ("Pedido #1: cancelado") |
| 7 | O driver `pg` não entende o `?schema=` do Prisma usado no laboratório | Ao comparar com o projeto `ppw` do aluno | `separarSchema()` tira o parâmetro da URL antes de passar ao `pg` |
| 8 | A 1ª versão do item 7 aplicava o schema com `client.query('SET search_path ...')` sem `await`, no evento `connect` do pool. A próxima query era enfileirada na mesma conexão, o que o `pg` 8 marca como obsoleto e o `pg` 9 vai recusar | Aviso `DeprecationWarning: Calling client.query() when the client is already executing a query` na 1ª subida contra o PostgreSQL do laboratório | O schema vai no handshake da conexão: `new Pool({ options: '-c search_path=<schema>' })`. Não há query extra nem corrida |
