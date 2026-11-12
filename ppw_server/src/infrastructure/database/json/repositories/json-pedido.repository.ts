import { Injectable } from '@nestjs/common';
import { Pedido } from '../../../../domain/entities/pedido.entity';
import { PedidoRepository } from '../../../../domain/repositories/pedido.repository';
import { JsonDatabase } from '../json-database';
import { PedidoJsonMapper } from '../mappers/pedido-json.mapper';

@Injectable()
export class JsonPedidoRepository implements PedidoRepository {
  constructor(private readonly database: JsonDatabase) {}

  async findAll(): Promise<Pedido[]> {
    return this.database.listar('pedidos').map((record) => PedidoJsonMapper.toDomain(record));
  }

  async findById(id: string): Promise<Pedido | null> {
    const record = this.database.listar('pedidos').find((p) => p.id === id);
    return record ? PedidoJsonMapper.toDomain(record) : null;
  }

  // O número continua de onde parou, mesmo que pedidos tenham sido excluídos do fim da lista
  async nextNumero(): Promise<number> {
    const ultimoNumero = this.database.listar('pedidos').reduce((maior, p) => Math.max(maior, p.numero), 0);
    return ultimoNumero + 1;
  }

  async create(pedido: Pedido): Promise<void> {
    const records = this.database.listar('pedidos');
    records.push(PedidoJsonMapper.toRecord(pedido));
    this.database.salvar('pedidos', records);
  }

  async update(pedido: Pedido): Promise<void> {
    const records = this.database.listar('pedidos');
    this.database.salvar(
      'pedidos',
      records.map((p) => (p.id === pedido.id ? PedidoJsonMapper.toRecord(pedido) : p)),
    );
  }

  async delete(id: string): Promise<void> {
    const records = this.database.listar('pedidos');
    this.database.salvar(
      'pedidos',
      records.filter((p) => p.id !== id),
    );
  }
}
