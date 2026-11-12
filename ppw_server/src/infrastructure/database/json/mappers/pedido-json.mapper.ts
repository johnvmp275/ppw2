import { Pedido } from '../../../../domain/entities/pedido.entity';
import { ItemPedido } from '../../../../domain/value-objects/item-pedido';
import { StatusPedido } from '../../../../domain/value-objects/status-pedido';
import { PedidoRecord } from '../json-database';

// Converte entre a entidade do domínio e o registro gravado no arquivo
export class PedidoJsonMapper {
  static toDomain(record: PedidoRecord): Pedido {
    return Pedido.restaurar(record.id, {
      numero: record.numero,
      cliente: record.cliente,
      telefone: record.telefone ?? '',
      endereco: record.endereco,
      observacao: record.observacao ?? '',
      itens: record.itens.map((item) => ItemPedido.criar(item)),
      status: record.status as StatusPedido,
      historico: record.historico.map((h) => ({ status: h.status as StatusPedido, data: new Date(h.data) })),
      criadoEm: new Date(record.criadoEm),
      atualizadoEm: new Date(record.atualizadoEm),
    });
  }

  // total e subtotal são calculados pela entidade, mas também são gravados para facilitar a leitura do JSON
  static toRecord(pedido: Pedido): PedidoRecord {
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
