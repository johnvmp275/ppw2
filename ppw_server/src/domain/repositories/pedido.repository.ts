import { Pedido } from '../entities/pedido.entity';
import { ConsultasTransicao } from '../state-machine/acao-pedido';
import { StatusPedido } from '../value-objects/status-pedido';

export interface FiltroPedidos {
  status?: StatusPedido;
}

// Contrato de persistência dos pedidos (veja a explicação em produto.repository.ts)
export abstract class PedidoRepository implements ConsultasTransicao {
  abstract findAll(filtro?: FiltroPedidos): Promise<Pedido[]>;
  abstract findById(id: string): Promise<Pedido | null>;
  // SELECT ... FOR UPDATE: trava a linha até o fim da transação (bloqueio pessimista)
  abstract findByIdParaAtualizar(id: string): Promise<Pedido | null>;
  // Grava pedido + itens e preenche o número vindo da SEQUENCE
  abstract create(pedido: Pedido): Promise<void>;
  // UPDATE ... WHERE versao = :versao (bloqueio otimista). Lança ConflitoError se outra
  // transação gravou antes. Substitui os itens do pedido.
  abstract update(pedido: Pedido): Promise<void>;
  abstract contarEntregasEmRota(entregadorId: string): Promise<number>;
}
