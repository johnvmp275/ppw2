import { StatusPedido } from '../../domain/value-objects/status-pedido';

export interface EventoPedido {
  tipo: 'PEDIDO_CRIADO' | 'PEDIDO_ALTERADO' | 'PEDIDO_TRANSICIONADO';
  pedidoId: string;
  numero: number | null;
  status: StatusPedido;
  versao: number;
  acao: string;
  ocorridoEm: string;
}

// Observer: os casos de uso avisam que algo mudou, sem saber quem está ouvindo
// (hoje, as conexões SSE da cozinha e do cliente). Só é chamado DEPOIS do commit,
// para ninguém ser avisado de uma mudança que sofreu rollback.
export abstract class PublicadorEventos {
  abstract publicar(evento: EventoPedido): void;
}
