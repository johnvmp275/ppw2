import { Pedido } from '../../../domain/entities/pedido.entity';
import { NotFoundError } from '../../../domain/errors/domain.error';
import { PedidoRepository } from '../../../domain/repositories/pedido.repository';

// Usado pelo painel da cozinha para mover o pedido entre as etapas
export class UpdatePedidoStatusUseCase {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  async execute(id: string, status: string): Promise<Pedido> {
    const pedido = await this.pedidoRepository.findById(id);
    if (!pedido) {
      throw new NotFoundError(`O pedido com o id = ${id} não foi encontrado`);
    }

    pedido.alterarStatus(status);
    await this.pedidoRepository.update(pedido);
    return pedido;
  }
}
