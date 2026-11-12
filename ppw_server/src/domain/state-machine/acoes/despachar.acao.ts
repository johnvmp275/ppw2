import { GuardaTransicaoError } from '../../errors/domain.error';
import { AcaoPedido, ContextoTransicao, ResultadoTransicao } from '../acao-pedido';

// Um entregador leva no máximo esta quantidade de pedidos por viagem
export const LIMITE_ENTREGAS_SIMULTANEAS = 3;

// PRONTO_PARA_RETIRADA -> EM_ROTA_DE_ENTREGA.
// Quem despacha é o próprio entregador, que fica vinculado ao pedido.
export class DespacharAcao extends AcaoPedido {
  readonly nome = 'DESPACHAR';
  readonly rotulo = 'Sair para entrega';
  readonly origens = ['PRONTO_PARA_RETIRADA'] as const;
  readonly destino = 'EM_ROTA_DE_ENTREGA' as const;
  protected readonly papeis = ['ENTREGADOR'] as const;

  // Validação cruzada: depende de OUTROS pedidos, por isso consulta o banco.
  // A consulta trava a linha do entregador (FOR UPDATE) para que dois despachos
  // simultâneos do mesmo entregador não passem os dois pela contagem.
  protected async guarda({ usuario, consultas }: ContextoTransicao): Promise<void> {
    const emRota = await consultas.contarEntregasEmRota(usuario.id);
    if (emRota >= LIMITE_ENTREGAS_SIMULTANEAS) {
      throw new GuardaTransicaoError(
        `${usuario.nome} já está com ${emRota} pedido(s) em rota. ` +
          `O limite é ${LIMITE_ENTREGAS_SIMULTANEAS}: confirme uma entrega antes de sair com outro`,
      );
    }
  }

  protected efeitos({ pedido, usuario }: ContextoTransicao): ResultadoTransicao {
    pedido.atribuirEntregador(usuario.id);
    return { devolucoesEstoque: [], detalhes: { entregadorId: usuario.id, entregador: usuario.nome } };
  }
}
