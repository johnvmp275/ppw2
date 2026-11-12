import { Pedido } from '../entities/pedido.entity';

// Contrato de persistência dos pedidos (veja a explicação em produto.repository.ts)
export abstract class PedidoRepository {
  abstract findAll(): Promise<Pedido[]>;
  abstract findById(id: string): Promise<Pedido | null>;
  abstract nextNumero(): Promise<number>;
  abstract create(pedido: Pedido): Promise<void>;
  abstract update(pedido: Pedido): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
