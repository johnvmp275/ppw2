import { Pedido } from '../../../domain/entities/pedido.entity';
import { RegistroHistorico } from '../../../domain/repositories/historico.repository';
import { DescricaoAcao } from '../../../domain/state-machine/acao-pedido';

// Define o JSON que a API devolve (veja a explicação em produto.presenter.ts)
export class PedidoPresenter {
  static toHttp(pedido: Pedido, acoesDisponiveis: DescricaoAcao[] = []) {
    const agora = new Date();
    return {
      id: pedido.id,
      numero: pedido.numero,
      cliente: pedido.cliente,
      telefone: pedido.telefone,
      endereco: pedido.endereco,
      observacao: pedido.observacao,
      itens: pedido.itens.map((item) => ({
        produtoId: item.produtoId,
        nome: item.nome,
        precoUnitario: item.precoUnitario,
        quantidade: item.quantidade,
        subtotal: item.subtotal,
        tempoPreparoMin: item.tempoPreparoMin,
        reservaEstoque: item.reservaEstoque,
      })),
      total: pedido.total,
      status: pedido.status,
      versao: pedido.versao,
      entregadorId: pedido.entregadorId,
      tempoPreparoMin: pedido.tempoPreparoMin,
      prazoPreparoEm: pedido.prazoPreparoEm?.toISOString() ?? null,
      atrasado: pedido.estaAtrasado(agora),
      valorPerda: pedido.valorPerda,
      // Botões que a UI deve mostrar para o usuário que fez a requisição
      acoesDisponiveis,
      criadoEm: pedido.criadoEm.toISOString(),
      atualizadoEm: pedido.atualizadoEm.toISOString(),
    };
  }

  static historicoToHttp(registro: RegistroHistorico) {
    return {
      id: registro.id,
      acao: registro.acao,
      estadoAnterior: registro.estadoAnterior,
      novoEstado: registro.novoEstado,
      autor: { id: registro.autorId, nome: registro.autorNome, papel: registro.autorPapel },
      justificativa: registro.justificativa,
      detalhes: registro.detalhes,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}
