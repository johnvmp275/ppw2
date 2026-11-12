import { Pedido } from '../../entities/pedido.entity';
import { Usuario } from '../../entities/usuario.entity';
import { AcaoPedido } from '../acao-pedido';

// EM_ROTA_DE_ENTREGA -> ENTREGUE.
// Entregador só confirma os pedidos que ele mesmo levou; o gerente pode confirmar qualquer um.
export class ConfirmarEntregaAcao extends AcaoPedido {
  readonly nome = 'CONFIRMAR_ENTREGA';
  readonly rotulo = 'Confirmar entrega';
  readonly origens = ['EM_ROTA_DE_ENTREGA'] as const;
  readonly destino = 'ENTREGUE' as const;
  protected readonly papeis = ['ENTREGADOR', 'GERENTE'] as const;

  podeExecutar(usuario: Usuario, pedido: Pedido): boolean {
    if (!super.podeExecutar(usuario, pedido)) {
      return false;
    }
    return usuario.papel === 'GERENTE' || pedido.entregadorId === usuario.id;
  }
}
