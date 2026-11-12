import { AcaoPedido } from '../acao-pedido';

// PRONTO_PARA_RETIRADA -> EM_PREPARO.
// Na conferência da embalagem algo deu errado (item faltando, prato frio...). Sempre justificado.
export class DevolverAoPreparoAcao extends AcaoPedido {
  readonly nome = 'DEVOLVER_AO_PREPARO';
  readonly rotulo = 'Devolver ao preparo';
  readonly origens = ['PRONTO_PARA_RETIRADA'] as const;
  readonly destino = 'EM_PREPARO' as const;
  protected readonly papeis = ['COZINHEIRO', 'GERENTE'] as const;

  exigeJustificativa(): boolean {
    return true;
  }
}
