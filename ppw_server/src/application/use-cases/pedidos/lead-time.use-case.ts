import { HistoricoRepository, LeadTimeEtapa } from '../../../domain/repositories/historico.repository';

// Quanto tempo, em média, os pedidos ficam em cada coluna do kanban
export class LeadTimeUseCase {
  constructor(private readonly historicoRepository: HistoricoRepository) {}

  execute(): Promise<LeadTimeEtapa[]> {
    return this.historicoRepository.leadTimePorEtapa();
  }
}
