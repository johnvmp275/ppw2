import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { EventoPedido } from '../src/application/ports/publicador-eventos';
import { Database } from '../src/infrastructure/database/postgres/database';
import { RxPublicadorEventos } from '../src/infrastructure/events/rx-publicador-eventos';

// Sobe a API inteira com um PostgreSQL (PGlite) em memória, novo a cada teste,
// com as mesmas migrações e o mesmo seed do ambiente de desenvolvimento.
const ATENDENTE = '00000000-0000-4000-8000-000000000001';
const COZINHEIRO = '00000000-0000-4000-8000-000000000002';
const ENTREGADOR = '00000000-0000-4000-8000-000000000003';
const GERENTE = '00000000-0000-4000-8000-000000000005';

const MARMITA = '10000000-0000-4000-8000-000000000001'; // feita na hora, 20 min, R$ 24,90
const REFRI = '10000000-0000-4000-8000-000000000004'; // estoque 24
const PUDIM = '10000000-0000-4000-8000-000000000006'; // estoque 3

const entrega = { cliente: 'Maria Souza', endereco: 'Rua A, 10' };

describe('API de delivery (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;

  beforeEach(async () => {
    process.env.PGLITE_DIR = 'memory://';
    delete process.env.DATABASE_URL;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(Database);
  });

  afterEach(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const como = (usuarioId: string) => ({ 'X-Usuario-Id': usuarioId });

  async function criarPedido(itens = [{ produtoId: MARMITA, quantidade: 2 }, { produtoId: REFRI, quantidade: 1 }]) {
    const res = await api().post('/pedidos').set(como(ATENDENTE)).send({ ...entrega, itens }).expect(201);
    return res.body;
  }

  function acao(id: string, nome: string, usuarioId: string, versao: number, justificativa?: string) {
    return api().post(`/pedidos/${id}/acoes/${nome}`).set(como(usuarioId)).send({ versao, justificativa });
  }

  async function estoque(produtoId: string) {
    return (await api().get(`/produtos/${produtoId}`).expect(200)).body.estoque;
  }

  it('identifica o usuário: 401 sem perfil, cardápio público', async () => {
    await api().get('/pedidos').expect(401);
    await api().get('/pedidos').set(como('nao-existe')).expect(401);
    await api().get('/produtos').expect(200);
  });

  it('percorre o fluxo pelas ações e grava a trilha de auditoria com autor e justificativa', async () => {
    const pedido = await criarPedido();
    expect(pedido).toMatchObject({ numero: 1, status: 'RECEBIDO', versao: 1, total: 55.8 });

    let atual = (await acao(pedido.id, 'iniciar-preparo', COZINHEIRO, 1).expect(200)).body;
    expect(atual).toMatchObject({ status: 'EM_PREPARO', versao: 2 });
    expect(atual.prazoPreparoEm).not.toBeNull();

    atual = (await acao(pedido.id, 'marcar-pronto', COZINHEIRO, 2).expect(200)).body;
    atual = (await acao(pedido.id, 'devolver-ao-preparo', GERENTE, 3, 'Faltou o talher na embalagem').expect(200)).body;
    atual = (await acao(pedido.id, 'marcar-pronto', COZINHEIRO, 4).expect(200)).body;
    atual = (await acao(pedido.id, 'despachar', ENTREGADOR, 5).expect(200)).body;
    atual = (await acao(pedido.id, 'confirmar-entrega', ENTREGADOR, 6).expect(200)).body;
    expect(atual).toMatchObject({ status: 'ENTREGUE', versao: 7, entregadorId: ENTREGADOR, acoesDisponiveis: [] });

    const historico = (await api().get(`/pedidos/${pedido.id}/historico`).set(como(GERENTE)).expect(200)).body;
    expect(historico.map((h) => [h.estadoAnterior, h.novoEstado])).toEqual([
      [null, 'RECEBIDO'],
      ['RECEBIDO', 'EM_PREPARO'],
      ['EM_PREPARO', 'PRONTO_PARA_RETIRADA'],
      ['PRONTO_PARA_RETIRADA', 'EM_PREPARO'],
      ['EM_PREPARO', 'PRONTO_PARA_RETIRADA'],
      ['PRONTO_PARA_RETIRADA', 'EM_ROTA_DE_ENTREGA'],
      ['EM_ROTA_DE_ENTREGA', 'ENTREGUE'],
    ]);
    expect(historico[3]).toMatchObject({
      acao: 'DEVOLVER_AO_PREPARO',
      justificativa: 'Faltou o talher na embalagem',
      autor: { id: GERENTE, papel: 'GERENTE' },
    });

    const leadTime = (await api().get('/pedidos/metricas/lead-time').set(como(GERENTE)).expect(200)).body;
    expect(leadTime.map((e) => e.status)).toEqual(['RECEBIDO', 'EM_PREPARO', 'PRONTO_PARA_RETIRADA', 'EM_ROTA_DE_ENTREGA']);
  });

  it('não aceita status por formulário (CRUD ingênuo) e devolve 403/422 com a mensagem da regra', async () => {
    const pedido = await criarPedido();

    await api().patch(`/pedidos/${pedido.id}/status`).set(como(GERENTE)).send({ status: 'ENTREGUE' }).expect(404);
    await api()
      .put(`/pedidos/${pedido.id}`)
      .set(como(GERENTE))
      .send({ ...entrega, itens: [{ produtoId: MARMITA, quantidade: 1 }], versao: 1, status: 'ENTREGUE' })
      .expect(422);

    const proibido = await acao(pedido.id, 'iniciar-preparo', ATENDENTE, 1).expect(403);
    expect(proibido.body.message).toContain('ATENDENTE');
    const invalida = await acao(pedido.id, 'confirmar-entrega', GERENTE, 1).expect(422);
    expect(invalida.body.message).toContain('RECEBIDO');
    await acao(pedido.id, 'cancelar', ATENDENTE, 1, 'curta').expect(422);
    await acao(pedido.id, 'iniciar-preparo', COZINHEIRO, undefined as unknown as number).expect(400);

    expect((await api().get(`/pedidos/${pedido.id}`).set(como(GERENTE))).body.status).toBe('RECEBIDO');
  });

  it('concorrência: duas ações simultâneas na mesma versão -> uma vence, a outra recebe 409', async () => {
    const pedido = await criarPedido();

    const respostas = await Promise.all([
      acao(pedido.id, 'iniciar-preparo', COZINHEIRO, 1),
      acao(pedido.id, 'cancelar', ATENDENTE, 1, 'Cliente ligou desistindo'),
    ]);

    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    const historico = (await api().get(`/pedidos/${pedido.id}/historico`).set(como(GERENTE))).body;
    expect(historico).toHaveLength(2); // CRIAR + só a ação que venceu
  });

  it('concorrência: vendas simultâneas não vendem o mesmo pudim duas vezes', async () => {
    const vendas = await Promise.all(
      Array.from({ length: 5 }, () =>
        api()
          .post('/pedidos')
          .set(como(ATENDENTE))
          .send({ ...entrega, itens: [{ produtoId: PUDIM, quantidade: 1 }] }),
      ),
    );

    expect(vendas.filter((r) => r.status === 201)).toHaveLength(3);
    expect(vendas.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await estoque(PUDIM)).toBe(0);
    // A SEQUENCE não repete número, mesmo com pedidos que deram rollback
    const numeros = vendas.filter((r) => r.status === 201).map((r) => r.body.numero);
    expect(new Set(numeros).size).toBe(3);
  });

  it('atomicidade: se um item não tem estoque, nada do pedido é gravado', async () => {
    const res = await api()
      .post('/pedidos')
      .set(como(ATENDENTE))
      .send({ ...entrega, itens: [{ produtoId: REFRI, quantidade: 2 }, { produtoId: PUDIM, quantidade: 10 }] })
      .expect(409);

    expect(res.body.message).toContain('Estoque insuficiente de Pudim');
    expect(await estoque(REFRI)).toBe(24);
    expect((await api().get('/pedidos').set(como(GERENTE))).body).toHaveLength(0);
  });

  it('cancelamento durante o preparo devolve o lacrado ao estoque e registra a perda', async () => {
    const pedido = await criarPedido();
    expect(await estoque(REFRI)).toBe(23);
    await acao(pedido.id, 'iniciar-preparo', COZINHEIRO, 1).expect(200);

    await acao(pedido.id, 'cancelar', ATENDENTE, 2, 'Cliente desistiu').expect(403);
    const cancelado = (await acao(pedido.id, 'cancelar', GERENTE, 2, 'Cliente desistiu').expect(200)).body;

    expect(cancelado).toMatchObject({ status: 'CANCELADO', valorPerda: 49.8 });
    expect(await estoque(REFRI)).toBe(24);

    const { rows } = await db.query<{ tipo: string; quantidade: number }>(
      'SELECT tipo, quantidade FROM movimentacoes_estoque WHERE pedido_id = $1 ORDER BY id',
      [pedido.id],
    );
    expect(rows).toEqual([
      { tipo: 'RESERVA', quantidade: -1 },
      { tipo: 'DEVOLUCAO', quantidade: 1 },
    ]);
  });

  it('adicionais e remoções: em preparo exigem justificativa e ajustam estoque e perda', async () => {
    const pedido = await criarPedido();
    await acao(pedido.id, 'iniciar-preparo', COZINHEIRO, 1).expect(200);
    const novosItens = [
      { produtoId: MARMITA, quantidade: 1 },
      { produtoId: REFRI, quantidade: 3 },
    ];

    await api().put(`/pedidos/${pedido.id}`).set(como(ATENDENTE)).send({ ...entrega, itens: novosItens, versao: 2 }).expect(422);
    await api()
      .put(`/pedidos/${pedido.id}`)
      .set(como(COZINHEIRO))
      .send({ ...entrega, itens: novosItens, versao: 2, justificativa: 'Cliente pediu mais refri' })
      .expect(403);

    const alterado = (
      await api()
        .put(`/pedidos/${pedido.id}`)
        .set(como(ATENDENTE))
        .send({ ...entrega, itens: novosItens, versao: 2, justificativa: 'Cliente trocou 1 marmita por 2 refris' })
        .expect(200)
    ).body;

    expect(alterado).toMatchObject({ status: 'EM_PREPARO', versao: 3, total: 42.9, valorPerda: 24.9 });
    expect(await estoque(REFRI)).toBe(21);

    await acao(pedido.id, 'marcar-pronto', COZINHEIRO, 3).expect(200);
    await api()
      .put(`/pedidos/${pedido.id}`)
      .set(como(GERENTE))
      .send({ ...entrega, itens: novosItens, versao: 4, justificativa: 'Tentando alterar depois de pronto' })
      .expect(422);
  });

  it('limita a 3 entregas simultâneas por entregador', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const pedido = await criarPedido([{ produtoId: MARMITA, quantidade: 1 }]);
      await acao(pedido.id, 'iniciar-preparo', COZINHEIRO, 1).expect(200);
      await acao(pedido.id, 'marcar-pronto', COZINHEIRO, 2).expect(200);
      ids.push(pedido.id);
    }

    for (const id of ids.slice(0, 3)) {
      await acao(id, 'despachar', ENTREGADOR, 3).expect(200);
    }
    const lotado = await acao(ids[3], 'despachar', ENTREGADOR, 3).expect(422);
    expect(lotado.body.message).toContain('limite é 3');
  });

  it('a trilha de auditoria é imutável no próprio banco', async () => {
    await criarPedido();
    await expect(db.query("UPDATE pedido_historico SET justificativa = 'apagando rastro'")).rejects.toThrow(
      /somente inserção/,
    );
    await expect(db.query('DELETE FROM pedido_historico')).rejects.toThrow(/somente inserção/);
  });

  it('publica evento (Observer/SSE) só depois do commit', async () => {
    const eventos: EventoPedido[] = [];
    const assinatura = app.get(RxPublicadorEventos).eventos$.subscribe((e) => eventos.push(e));

    const pedido = await criarPedido();
    await acao(pedido.id, 'iniciar-preparo', ATENDENTE, 1).expect(403); // rollback: não publica
    await acao(pedido.id, 'iniciar-preparo', COZINHEIRO, 1).expect(200);
    assinatura.unsubscribe();

    expect(eventos.map((e) => [e.tipo, e.status])).toEqual([
      ['PEDIDO_CRIADO', 'RECEBIDO'],
      ['PEDIDO_TRANSICIONADO', 'EM_PREPARO'],
    ]);

    const publico = (await api().get(`/acompanhamento/${pedido.id}`).expect(200)).body;
    expect(publico).toMatchObject({ numero: 1, cliente: 'Maria', status: 'EM_PREPARO' });
    expect(publico.endereco).toBeUndefined();
  });

  it('cardápio: só o gerente altera, e o estoque muda por ajuste relativo', async () => {
    await api().post('/produtos').set(como(ATENDENTE)).send({ nome: 'Água', preco: 4 }).expect(403);
    const agua = (
      await api().post('/produtos').set(como(GERENTE)).send({ nome: 'Água', preco: 4, estoqueInicial: 5 }).expect(201)
    ).body;

    await api().post(`/produtos/${agua.id}/estoque`).set(como(GERENTE)).send({ delta: 10 }).expect(200);
    await api().post(`/produtos/${agua.id}/estoque`).set(como(GERENTE)).send({ delta: -100 }).expect(422);
    expect(await estoque(agua.id)).toBe(15);

    // PUT não mexe no estoque, mesmo se o campo vier no corpo
    await api().put(`/produtos/${agua.id}`).set(como(GERENTE)).send({ nome: 'Água com gás', preco: 5, estoque: 999 }).expect(200);
    expect(await estoque(agua.id)).toBe(15);

    await api().delete(`/produtos/${agua.id}`).set(como(GERENTE)).expect(200);
    await api()
      .post('/pedidos')
      .set(como(ATENDENTE))
      .send({ ...entrega, itens: [{ produtoId: agua.id, quantidade: 1 }] })
      .expect(400);
  });
});
