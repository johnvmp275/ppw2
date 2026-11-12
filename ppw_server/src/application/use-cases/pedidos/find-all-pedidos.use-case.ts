import { Pedido } from '../../../domain/entities/pedido.entity';
import { ValidationError } from '../../../domain/errors/domain.error';
import { PedidoRepository } from '../../../domain/repositories/pedido.repository';
import { isStatusPedido } from '../../../domain/value-objects/status-pedido';

export class FindAllPedidosUseCase {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  execute(status?: string): Promise<Pedido[]> {
    if (status !== undefined && !isStatusPedido(status)) {
      throw new ValidationError(`Status inválido para filtro: ${status}`);
    }
    return this.pedidoRepository.findAll({ status });
  }
}
