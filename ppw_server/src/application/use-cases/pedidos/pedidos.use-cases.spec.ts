import { InMemoryPedidoRepository } from '../../../../test/repositories/in-memory-pedido.repository';
import { InMemoryProdutoRepository } from '../../../../test/repositories/in-memory-produto.repository';
import { Produto } from '../../../domain/entities/produto.entity';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain.error';
import { CreatePedidoUseCase } from './create-pedido.use-case';
import { DeletePedidoUseCase } from './delete-pedido.use-case';
import { UpdatePedidoStatusUseCase } from './update-pedido-status.use-case';
import { UpdatePedidoUseCase } from './update-pedido.use-case';

describe('Casos de uso de pedidos', () => {
  let pedidoRepository: InMemoryPedidoRepository;
  let produtoRepository: InMemoryProdutoRepository;
  let marmita: Produto;
  let suco: Produto;

  const entrega = { cliente: 'Maria', endereco: 'Rua A, 10' };

  beforeEach(() => {
    pedidoRepository = new InMemoryPedidoRepository();
    produtoRepository = new InMemoryProdutoRepository();
    marmita = Produto.criar({ nome: 'Marmita', preco: 25 });
    suco = Produto.criar({ nome: 'Suco', preco: 9.5 });
    produtoRepository.produtos = [marmita, suco];
  });

  function criarPedido() {
    return new CreatePedidoUseCase(pedidoRepository, produtoRepository).execute({
      ...entrega,
      itens: [
        { produtoId: marmita.id, quantidade: 2 },
        { produtoId: suco.id, quantidade: 1 },
      ],
    });
  }

  it('cria o pedido como RECEBIDO, com número sequencial e preço vindo do cadastro', async () => {
    const primeiro = await criarPedido();
    const segundo = await criarPedido();

    expect(primeiro.numero).toBe(1);
    expect(segundo.numero).toBe(2);
    expect(primeiro.status).toBe('RECEBIDO');
    expect(primeiro.historico).toHaveLength(1);
    expect(primeiro.total).toBe(59.5);
  });

  it('não cria pedido sem itens, sem cliente ou com produto inexistente', async () => {
    const createPedido = new CreatePedidoUseCase(pedidoRepository, produtoRepository);

    await expect(createPedido.execute({ ...entrega, itens: [] })).rejects.toThrow(ValidationError);
    await expect(
      createPedido.execute({ ...entrega, cliente: '', itens: [{ produtoId: suco.id, quantidade: 1 }] }),
    ).rejects.toThrow(ValidationError);
    await expect(
      createPedido.execute({ ...entrega, itens: [{ produtoId: 'nao-existe', quantidade: 1 }] }),
    ).rejects.toThrow(ValidationError);
  });

  it('move o pedido no fluxo e registra o histórico', async () => {
    const pedido = await criarPedido();
    const updateStatus = new UpdatePedidoStatusUseCase(pedidoRepository);

    await updateStatus.execute(pedido.id, 'EM_PREPARO');
    const atualizado = await updateStatus.execute(pedido.id, 'PRONTO_PARA_RETIRADA');

    expect(atualizado.status).toBe('PRONTO_PARA_RETIRADA');
    expect(atualizado.historico.map((h) => h.status)).toEqual(['RECEBIDO', 'EM_PREPARO', 'PRONTO_PARA_RETIRADA']);
    await expect(updateStatus.execute(pedido.id, 'VOANDO')).rejects.toThrow(ValidationError);
  });

  it('altera os dados e itens, mantendo o preço da venda nos itens que já existiam', async () => {
    const pedido = await criarPedido();
    marmita.atualizar({ nome: 'Marmita', preco: 30 });

    const alterado = await new UpdatePedidoUseCase(pedidoRepository, produtoRepository).execute(pedido.id, {
      cliente: 'Maria Souza',
      endereco: 'Rua B, 20',
      observacao: 'Sem cebola',
      itens: [{ produtoId: marmita.id, quantidade: 3 }],
      status: 'EM_PREPARO',
    });

    expect(alterado.cliente).toBe('Maria Souza');
    expect(alterado.observacao).toBe('Sem cebola');
    expect(alterado.itens).toHaveLength(1);
    expect(alterado.itens[0].precoUnitario).toBe(25);
    expect(alterado.total).toBe(75);
    expect(alterado.status).toBe('EM_PREPARO');
  });

  it('exclui o pedido e avisa quando ele não existe', async () => {
    const pedido = await criarPedido();
    const deletePedido = new DeletePedidoUseCase(pedidoRepository);

    await deletePedido.execute(pedido.id);

    expect(pedidoRepository.pedidos).toHaveLength(0);
    await expect(deletePedido.execute(pedido.id)).rejects.toThrow(NotFoundError);
  });
});
