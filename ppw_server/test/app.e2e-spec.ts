import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PedidoRepository } from '../src/domain/repositories/pedido.repository';
import { ProdutoRepository } from '../src/domain/repositories/produto.repository';
import { InMemoryPedidoRepository } from './repositories/in-memory-pedido.repository';
import { InMemoryProdutoRepository } from './repositories/in-memory-produto.repository';

// Sobe a API inteira, mas troca os repositórios JSON pelos de memória
// para não mexer no data/db.json de verdade
describe('API de delivery (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProdutoRepository)
      .useValue(new InMemoryProdutoRepository())
      .overrideProvider(PedidoRepository)
      .useValue(new InMemoryPedidoRepository())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('faz o CRUD de produtos', async () => {
    const server = app.getHttpServer();

    const criado = await request(server).post('/produtos').send({ nome: 'Pudim', preco: 8 }).expect(201);
    const id = criado.body.id;

    await request(server)
      .get('/produtos')
      .expect(200)
      .expect((res) => expect(res.body).toHaveLength(1));
    await request(server)
      .put(`/produtos/${id}`)
      .send({ nome: 'Pudim de leite', categoria: 'Sobremesas', preco: 9 })
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ nome: 'Pudim de leite', preco: 9 }));
    await request(server).delete(`/produtos/${id}`).expect(200);
    await request(server).get(`/produtos/${id}`).expect(404);
  });

  it('devolve 400 com a mensagem da regra de negócio', async () => {
    await request(app.getHttpServer())
      .post('/produtos')
      .send({ nome: '', preco: 8 })
      .expect(400)
      .expect((res) => expect(res.body.message).toBe('O nome do produto é obrigatório'));
  });

  it('faz o CRUD de pedidos e move o status', async () => {
    const server = app.getHttpServer();
    const produto = await request(server).post('/produtos').send({ nome: 'Marmita', preco: 25 });

    const criado = await request(server)
      .post('/pedidos')
      .send({ cliente: 'Ana', endereco: 'Rua A', itens: [{ produtoId: produto.body.id, quantidade: 2 }] })
      .expect(201);
    const id = criado.body.id;
    expect(criado.body).toMatchObject({ numero: 1, status: 'RECEBIDO', total: 50 });

    await request(server)
      .patch(`/pedidos/${id}/status`)
      .send({ status: 'EM_PREPARO' })
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('EM_PREPARO'));
    await request(server)
      .put(`/pedidos/${id}`)
      .send({ cliente: 'Ana Lima', endereco: 'Rua B', itens: [{ produtoId: produto.body.id, quantidade: 1 }] })
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ cliente: 'Ana Lima', total: 25, status: 'EM_PREPARO' }));
    await request(server).delete(`/pedidos/${id}`).expect(200);
    await request(server).get(`/pedidos/${id}`).expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
