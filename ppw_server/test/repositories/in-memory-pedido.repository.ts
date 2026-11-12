import { Pedido } from '../../src/domain/entities/pedido.entity';
import { PedidoRepository } from '../../src/domain/repositories/pedido.repository';

// Implementação em memória do contrato, usada nos testes no lugar do arquivo JSON
export class InMemoryPedidoRepository implements PedidoRepository {
  pedidos: Pedido[] = [];

  async findAll(): Promise<Pedido[]> {
    return [...this.pedidos];
  }

  async findById(id: string): Promise<Pedido | null> {
    return this.pedidos.find((p) => p.id === id) ?? null;
  }

  async nextNumero(): Promise<number> {
    return this.pedidos.reduce((maior, p) => Math.max(maior, p.numero), 0) + 1;
  }

  async create(pedido: Pedido): Promise<void> {
    this.pedidos.push(pedido);
  }

  async update(pedido: Pedido): Promise<void> {
    this.pedidos = this.pedidos.map((p) => (p.id === pedido.id ? pedido : p));
  }

  async delete(id: string): Promise<void> {
    this.pedidos = this.pedidos.filter((p) => p.id !== id);
  }
}
