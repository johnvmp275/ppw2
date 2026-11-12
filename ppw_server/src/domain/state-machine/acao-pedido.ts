import { Papel, Usuario } from '../entities/usuario.entity';
import { Pedido } from '../entities/pedido.entity';
import { GuardaTransicaoError, PermissaoNegadaError, TransicaoInvalidaError } from '../errors/domain.error';
import { texto } from '../shared/normalizar';
import { StatusPedido } from '../value-objects/status-pedido';

export const JUSTIFICATIVA_MINIMA = 10;

// Consultas que algumas guardas precisam fazer no banco. A ação não sabe que existe SQL:
// quem implementa esta interface é o repositório, dentro da mesma transação da ação.
export interface ConsultasTransicao {
  contarEntregasEmRota(entregadorId: string): Promise<number>;
}

export interface ContextoTransicao {
  pedido: Pedido;
  usuario: Usuario;
  justificativa: string;
  agora: Date;
  consultas: ConsultasTransicao;
}

export interface DevolucaoEstoque {
  produtoId: string;
  nome: string;
  quantidade: number;
}

// O que a ação pede para o caso de uso fazer além de mudar o status.
// A ação descreve o efeito; quem executa (UPDATE no estoque) é a camada de aplicação.
export interface ResultadoTransicao {
  devolucoesEstoque: DevolucaoEstoque[];
  detalhes: Record<string, unknown> | null;
}

export interface DescricaoAcao {
  nome: string;
  rotulo: string;
  destino: StatusPedido;
  exigeJustificativa: boolean;
}

// Uma ação (evento) da máquina de estados.
//
// OCP: para criar um caminho novo no fluxo, cria-se uma subclasse e registra-se na fábrica
// (criarMaquinaEstadosPedido). A máquina e as outras ações não mudam.
// SRP: cada ação conhece só a própria regra (origem, papéis, guarda e efeito).
// LSP: validar() e aplicar() são o contrato fixo (Template Method). As subclasses só preenchem
// os ganchos (guarda, efeitos, papeisPara...), então qualquer ação pode substituir outra
// dentro da máquina sem que ela precise saber qual é.
export abstract class AcaoPedido {
  abstract readonly nome: string;
  abstract readonly rotulo: string;
  abstract readonly origens: readonly StatusPedido[];
  abstract readonly destino: StatusPedido;
  protected abstract readonly papeis: readonly Papel[];

  saiDe(status: StatusPedido): boolean {
    return this.origens.includes(status);
  }

  // Papéis que podem executar a ação a partir do estado atual do pedido (linha da matriz RBAC)
  papeisPara(_status: StatusPedido): readonly Papel[] {
    return this.papeis;
  }

  podeExecutar(usuario: Usuario, pedido: Pedido): boolean {
    return usuario.ativo && usuario.temPapel(...this.papeisPara(pedido.status));
  }

  exigeJustificativa(_pedido: Pedido, _agora: Date): boolean {
    return false;
  }

  // Ordem fixa das verificações: estado de origem -> permissão -> justificativa -> guarda específica
  async validar(ctx: ContextoTransicao): Promise<void> {
    const { pedido, usuario } = ctx;

    if (!this.saiDe(pedido.status)) {
      throw new TransicaoInvalidaError(
        `Não é possível "${this.rotulo}" o pedido #${pedido.numero}: ele está ${pedido.status}. ` +
          `Esta ação só vale a partir de: ${this.origens.join(', ')}`,
      );
    }

    if (!this.podeExecutar(usuario, pedido)) {
      throw new PermissaoNegadaError(
        `O perfil ${usuario.papel} não pode "${this.rotulo}" um pedido ${pedido.status}. ` +
          `Permitido para: ${this.papeisPara(pedido.status).join(', ')}`,
      );
    }

    if (this.exigeJustificativa(pedido, ctx.agora) && texto(ctx.justificativa).length < JUSTIFICATIVA_MINIMA) {
      throw new GuardaTransicaoError(
        `"${this.rotulo}" exige uma justificativa com pelo menos ${JUSTIFICATIVA_MINIMA} caracteres`,
      );
    }

    await this.guarda(ctx);
  }

  // Calcula os efeitos com o pedido ainda no estado anterior e depois muda o status
  aplicar(ctx: ContextoTransicao): ResultadoTransicao {
    const resultado = this.efeitos(ctx);
    ctx.pedido.aplicarTransicao(this.destino, ctx.agora);
    return resultado;
  }

  descrever(pedido: Pedido, agora: Date): DescricaoAcao {
    return {
      nome: this.nome,
      rotulo: this.rotulo,
      destino: this.destino,
      exigeJustificativa: this.exigeJustificativa(pedido, agora),
    };
  }

  // ----- Ganchos -----

  protected async guarda(_ctx: ContextoTransicao): Promise<void> {}

  protected efeitos(_ctx: ContextoTransicao): ResultadoTransicao {
    return { devolucoesEstoque: [], detalhes: null };
  }
}
