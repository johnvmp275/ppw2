import { Pedido } from '../../../domain/entities/pedido.entity';
import { NotFoundError } from '../../../domain/errors/domain.error';
import { PedidoRepository } from '../../../domain/repositories/pedido.repository';

export class DeletePedidoUseCase {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  async execute(id: string): Promise<Pedido> {
    const pedido = await this.pedidoRepository.findById(id);
    if (!pedido) {
      throw new NotFoundError(`O pedido com o id = ${id} não foi encontrado`);
    }

    await this.pedidoRepository.delete(id);
    return pedido;
  }
}
