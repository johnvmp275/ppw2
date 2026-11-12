import { DadosEntrega, Pedido } from '../../../domain/entities/pedido.entity';
import { NotFoundError } from '../../../domain/errors/domain.error';
import { PedidoRepository } from '../../../domain/repositories/pedido.repository';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';
import { ItemPedidoInput, montarItensPedido } from './montar-itens-pedido';

export interface UpdatePedidoInput extends DadosEntrega {
  itens: ItemPedidoInput[];
  // Opcional: o formulário de edição também pode mover o pedido de etapa
  status?: string;
}

export class UpdatePedidoUseCase {
  constructor(
    private readonly pedidoRepository: PedidoRepository,
    private readonly produtoRepository: ProdutoRepository,
  ) {}

  async execute(id: string, input: UpdatePedidoInput): Promise<Pedido> {
    const pedido = await this.pedidoRepository.findById(id);
    if (!pedido) {
      throw new NotFoundError(`O pedido com o id = ${id} não foi encontrado`);
    }

    const itens = await montarItensPedido(input.itens, this.produtoRepository, pedido.itens);
    pedido.atualizar(input, itens);
    if (input.status) {
      pedido.alterarStatus(input.status);
    }

    await this.pedidoRepository.update(pedido);
    return pedido;
  }
}
