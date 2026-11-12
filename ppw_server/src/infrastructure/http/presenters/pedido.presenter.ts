import { Pedido } from '../../../domain/entities/pedido.entity';

// Define o JSON que a API devolve (veja a explicação em produto.presenter.ts)
export class PedidoPresenter {
  static toHttp(pedido: Pedido) {
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
      })),
      total: pedido.total,
      status: pedido.status,
      historico: pedido.historico.map((h) => ({ status: h.status, data: h.data.toISOString() })),
      criadoEm: pedido.criadoEm.toISOString(),
      atualizadoEm: pedido.atualizadoEm.toISOString(),
    };
  }
}
