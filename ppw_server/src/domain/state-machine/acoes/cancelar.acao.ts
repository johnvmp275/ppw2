import { Papel } from '../../entities/usuario.entity';
import { arredondarMoeda } from '../../shared/normalizar';
import { StatusPedido } from '../../value-objects/status-pedido';
import { AcaoPedido, ContextoTransicao, DevolucaoEstoque, ResultadoTransicao } from '../acao-pedido';

// (RECEBIDO | EM_PREPARO | PRONTO_PARA_RETIRADA | EM_ROTA_DE_ENTREGA) -> CANCELADO
//
// RBAC por estado: antes da produção o atendente cancela; depois que a cozinha começou, só o gerente.
//
// Rollback parcial (o que acontece com o que já foi feito):
//  - RECEBIDO: nada foi produzido. Tudo que baixou estoque volta para o estoque.
//  - EM_PREPARO / PRONTO: itens lacrados (que baixaram estoque) voltam; pratos feitos na hora viram perda.
//  - EM_ROTA: tudo já saiu da loja. Nada volta e o pedido inteiro vira perda.
export class CancelarAcao extends AcaoPedido {
  readonly nome = 'CANCELAR';
  readonly rotulo = 'Cancelar pedido';
  readonly origens = ['RECEBIDO', 'EM_PREPARO', 'PRONTO_PARA_RETIRADA', 'EM_ROTA_DE_ENTREGA'] as const;
  readonly destino = 'CANCELADO' as const;
  protected readonly papeis = ['GERENTE'] as const;

  papeisPara(status: StatusPedido): readonly Papel[] {
    return status === 'RECEBIDO' ? ['ATENDENTE', 'GERENTE'] : this.papeis;
  }

  exigeJustificativa(): boolean {
    return true;
  }

  protected efeitos({ pedido }: ContextoTransicao): ResultadoTransicao {
    const saiuDaLoja = pedido.status === 'EM_ROTA_DE_ENTREGA';
    const produziu = pedido.status !== 'RECEBIDO';

    const devolucoesEstoque: DevolucaoEstoque[] = saiuDaLoja
      ? []
      : pedido.itens
          .filter((item) => item.reservaEstoque)
          .map((item) => ({ produtoId: item.produtoId, nome: item.nome, quantidade: item.quantidade }));

    const perdidos = saiuDaLoja ? pedido.itens : produziu ? pedido.itens.filter((item) => !item.reservaEstoque) : [];
    const perda = arredondarMoeda(perdidos.reduce((soma, item) => soma + item.subtotal, 0));

    if (perda > 0) {
      pedido.registrarPerda(perda);
    }

    return {
      devolucoesEstoque,
      detalhes: {
        cancelamentoEm: pedido.status,
        devolvidosAoEstoque: devolucoesEstoque.map((d) => `${d.quantidade}x ${d.nome}`),
        perdidos: perdidos.map((item) => `${item.quantidade}x ${item.nome}`),
        valorPerda: perda,
      },
    };
  }
}
