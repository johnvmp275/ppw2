import { DadosEntrega, Pedido } from '../entities/pedido.entity';
import { Usuario } from '../entities/usuario.entity';
import { GuardaTransicaoError, RegraNegocioError } from '../errors/domain.error';
import { arredondarMoeda, texto } from '../shared/normalizar';
import { JUSTIFICATIVA_MINIMA } from '../state-machine/acao-pedido';
import { ItemPedido } from '../value-objects/item-pedido';
import { StatusPedido } from '../value-objects/status-pedido';

// Adicionais e remoções só enquanto a comida não ficou pronta
export const STATUS_QUE_PERMITEM_ALTERACAO: readonly StatusPedido[] = ['RECEBIDO', 'EM_PREPARO'];

export interface MovimentoItem {
  produtoId: string;
  nome: string;
  quantidade: number;
}

export interface ResultadoAlteracao {
  // Estoque a baixar (item novo ou quantidade aumentada de produto com estoque)
  reservas: MovimentoItem[];
  // Estoque a devolver (item removido ou quantidade reduzida de produto com estoque)
  devolucoes: MovimentoItem[];
  valorPerda: number;
  detalhes: Record<string, unknown>;
}

// Regras para alterar dados/itens de um pedido que já existe.
// Não é uma transição de estado (o status não muda), mas é auditada do mesmo jeito.
export class PoliticaAlteracaoPedido {
  validar(pedido: Pedido, usuario: Usuario, justificativa: string) {
    usuario.exigirPapel(['ATENDENTE', 'GERENTE'], 'alterar pedidos');

    if (!STATUS_QUE_PERMITEM_ALTERACAO.includes(pedido.status)) {
      throw new RegraNegocioError(
        `O pedido #${pedido.numero} está ${pedido.status} e não pode mais ser alterado. ` +
          `Alterações só valem em: ${STATUS_QUE_PERMITEM_ALTERACAO.join(', ')}`,
      );
    }

    if (pedido.status === 'EM_PREPARO' && texto(justificativa).length < JUSTIFICATIVA_MINIMA) {
      throw new GuardaTransicaoError(
        `O preparo do pedido #${pedido.numero} já começou: informe uma justificativa ` +
          `(mínimo ${JUSTIFICATIVA_MINIMA} caracteres) para a cozinha saber o que mudou`,
      );
    }
  }

  aplicar(pedido: Pedido, dados: DadosEntrega, novosItens: ItemPedido[], agora: Date): ResultadoAlteracao {
    const emPreparo = pedido.status === 'EM_PREPARO';
    const antes = new Map(pedido.itens.map((item) => [item.produtoId, item]));
    const depois = new Map(novosItens.map((item) => [item.produtoId, item]));

    const reservas: MovimentoItem[] = [];
    const devolucoes: MovimentoItem[] = [];
    let valorPerda = 0;
    let maiorTempoAcrescentado = 0;

    for (const produtoId of new Set([...antes.keys(), ...depois.keys()])) {
      const antigo = antes.get(produtoId);
      const novo = depois.get(produtoId);
      const item = (novo ?? antigo)!;
      const delta = (novo?.quantidade ?? 0) - (antigo?.quantidade ?? 0);

      if (delta > 0) {
        if (item.reservaEstoque) reservas.push({ produtoId, nome: item.nome, quantidade: delta });
        maiorTempoAcrescentado = Math.max(maiorTempoAcrescentado, item.tempoPreparoMin);
      } else if (delta < 0) {
        if (antigo!.reservaEstoque) {
          devolucoes.push({ produtoId, nome: item.nome, quantidade: -delta });
        } else if (emPreparo) {
          // Prato feito na hora que já estava no fogo: não volta, vira perda
          valorPerda += -delta * antigo!.precoUnitario;
        }
      }
    }

    pedido.alterarDados(dados, novosItens);
    valorPerda = arredondarMoeda(valorPerda);
    if (valorPerda > 0) {
      pedido.registrarPerda(valorPerda);
    }

    // Adicional no meio do preparo empurra o prazo (nunca puxa para antes)
    if (emPreparo && maiorTempoAcrescentado > 0 && pedido.prazoPreparoEm) {
      const novoPrazo = new Date(agora.getTime() + maiorTempoAcrescentado * 60_000);
      if (novoPrazo > pedido.prazoPreparoEm) {
        pedido.definirPrazoPreparo(novoPrazo);
      }
    }

    return {
      reservas,
      devolucoes,
      valorPerda,
      detalhes: {
        itensAntes: [...antes.values()].map((i) => `${i.quantidade}x ${i.nome}`),
        itensDepois: novosItens.map((i) => `${i.quantidade}x ${i.nome}`),
        valorPerda,
        prazoPreparoEm: pedido.prazoPreparoEm?.toISOString() ?? null,
      },
    };
  }
}
