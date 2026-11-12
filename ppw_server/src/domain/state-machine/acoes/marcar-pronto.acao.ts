import { Pedido } from '../../entities/pedido.entity';
import { AcaoPedido, ContextoTransicao, ResultadoTransicao } from '../acao-pedido';

// EM_PREPARO -> PRONTO_PARA_RETIRADA.
// Guarda temporal: se o SLA estourou, a cozinha precisa justificar o atraso.
export class MarcarProntoAcao extends AcaoPedido {
  readonly nome = 'MARCAR_PRONTO';
  readonly rotulo = 'Marcar como pronto';
  readonly origens = ['EM_PREPARO'] as const;
  readonly destino = 'PRONTO_PARA_RETIRADA' as const;
  protected readonly papeis = ['COZINHEIRO', 'GERENTE'] as const;

  exigeJustificativa(pedido: Pedido, agora: Date): boolean {
    return pedido.estaAtrasado(agora);
  }

  protected efeitos({ pedido, agora }: ContextoTransicao): ResultadoTransicao {
    const atrasoMs = pedido.prazoPreparoEm ? agora.getTime() - pedido.prazoPreparoEm.getTime() : 0;
    return {
      devolucoesEstoque: [],
      detalhes: { atrasado: atrasoMs > 0, minutosDeAtraso: Math.max(0, Math.ceil(atrasoMs / 60_000)) },
    };
  }
}
