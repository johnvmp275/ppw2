import { NotFoundError } from '../../../domain/errors/domain.error';
import { HistoricoRepository, RegistroHistorico } from '../../../domain/repositories/historico.repository';
import { PedidoRepository } from '../../../domain/repositories/pedido.repository';

export class FindHistoricoPedidoUseCase {
  constructor(
    private readonly pedidoRepository: PedidoRepository,
    private readonly historicoRepository: HistoricoRepository,
  ) {}

  async execute(pedidoId: string): Promise<RegistroHistorico[]> {
    if (!(await this.pedidoRepository.findById(pedidoId))) {
      throw new NotFoundError(`O pedido com o id = ${pedidoId} não foi encontrado`);
    }
    return this.historicoRepository.listarPorPedido(pedidoId);
  }
}
