import { DadosEntrega, Pedido } from '../../../domain/entities/pedido.entity';
import { PedidoRepository } from '../../../domain/repositories/pedido.repository';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';
import { ItemPedidoInput, montarItensPedido } from './montar-itens-pedido';

export interface CreatePedidoInput extends DadosEntrega {
  itens: ItemPedidoInput[];
}

export class CreatePedidoUseCase {
  constructor(
    private readonly pedidoRepository: PedidoRepository,
    private readonly produtoRepository: ProdutoRepository,
  ) {}

  async execute(input: CreatePedidoInput): Promise<Pedido> {
    const itens = await montarItensPedido(input.itens, this.produtoRepository);
    const numero = await this.pedidoRepository.nextNumero();

    const pedido = Pedido.criar(numero, input, itens);
    await this.pedidoRepository.create(pedido);
    return pedido;
  }
}
