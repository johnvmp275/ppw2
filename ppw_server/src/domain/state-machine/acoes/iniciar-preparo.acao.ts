import { AcaoPedido, ContextoTransicao, ResultadoTransicao } from '../acao-pedido';

// Mesmo um pedido só de bebidas leva alguns minutos para ser separado e embalado
export const PRAZO_MINIMO_MIN = 5;

// RECEBIDO -> EM_PREPARO. Começa a contar o SLA da cozinha.
export class IniciarPreparoAcao extends AcaoPedido {
  readonly nome = 'INICIAR_PREPARO';
  readonly rotulo = 'Iniciar preparo';
  readonly origens = ['RECEBIDO'] as const;
  readonly destino = 'EM_PREPARO' as const;
  protected readonly papeis = ['COZINHEIRO', 'GERENTE'] as const;

  protected efeitos({ pedido, agora }: ContextoTransicao): ResultadoTransicao {
    const minutos = Math.max(pedido.tempoPreparoMin, PRAZO_MINIMO_MIN);
    const prazo = new Date(agora.getTime() + minutos * 60_000);
    pedido.definirPrazoPreparo(prazo);
    return { devolucoesEstoque: [], detalhes: { prazoPreparoEm: prazo.toISOString(), slaMin: minutos } };
  }
}
