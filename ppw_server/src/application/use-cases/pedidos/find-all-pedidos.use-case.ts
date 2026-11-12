import { Pedido } from '../../../domain/entities/pedido.entity';
import { PedidoRepository } from '../../../domain/repositories/pedido.repository';

export class FindAllPedidosUseCase {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  execute(): Promise<Pedido[]> {
    return this.pedidoRepository.findAll();
  }
}
