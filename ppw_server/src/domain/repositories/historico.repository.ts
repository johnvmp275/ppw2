import { StatusPedido } from '../value-objects/status-pedido';

export interface NovoRegistroHistorico {
  pedidoId: string;
  acao: string;
  // null só na criação do pedido
  estadoAnterior: StatusPedido | null;
  novoEstado: StatusPedido;
  autorId: string;
  justificativa: string | null;
  detalhes: Record<string, unknown> | null;
}

export interface RegistroHistorico extends NovoRegistroHistorico {
  id: number;
  autorNome: string;
  autorPapel: string;
  criadoEm: Date;
}

export interface LeadTimeEtapa {
  status: StatusPedido;
  pedidos: number;
  mediaMin: number;
  maximoMin: number;
}

// Trilha de auditoria. Só existe "registrar": a tabela é append-only
// (um trigger no banco recusa UPDATE e DELETE).
export abstract class HistoricoRepository {
  abstract registrar(registro: NovoRegistroHistorico): Promise<void>;
  abstract listarPorPedido(pedidoId: string): Promise<RegistroHistorico[]>;
  // Tempo médio que os pedidos passam em cada etapa, calculado a partir da trilha
  abstract leadTimePorEtapa(): Promise<LeadTimeEtapa[]>;
}
