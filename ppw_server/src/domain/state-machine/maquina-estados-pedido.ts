import { Pedido } from '../entities/pedido.entity';
import { Papel, Usuario } from '../entities/usuario.entity';
import { ValidationError } from '../errors/domain.error';
import { STATUS_PEDIDO, StatusPedido } from '../value-objects/status-pedido';
import { AcaoPedido, ContextoTransicao, DescricaoAcao, ResultadoTransicao } from './acao-pedido';
import { CancelarAcao } from './acoes/cancelar.acao';
import { ConfirmarEntregaAcao } from './acoes/confirmar-entrega.acao';
import { DespacharAcao } from './acoes/despachar.acao';
import { DevolverAoPreparoAcao } from './acoes/devolver-ao-preparo.acao';
import { IniciarPreparoAcao } from './acoes/iniciar-preparo.acao';
import { MarcarProntoAcao } from './acoes/marcar-pronto.acao';

export interface Transicao {
  acao: string;
  rotulo: string;
  origem: StatusPedido;
  destino: StatusPedido;
  papeis: readonly Papel[];
}

// A máquina não tem nenhum if/switch por ação: ela só procura a ação pelo nome e
// delega. Por isso ela fica fechada para modificação e aberta para extensão (OCP).
export class MaquinaEstadosPedido {
  private readonly acoes = new Map<string, AcaoPedido>();

  constructor(acoes: readonly AcaoPedido[]) {
    for (const acao of acoes) {
      if (this.acoes.has(acao.nome)) {
        throw new Error(`Ação ${acao.nome} registrada duas vezes na máquina de estados`);
      }
      this.acoes.set(acao.nome, acao);
    }
  }

  acao(nome: string): AcaoPedido {
    const acao = this.acoes.get(String(nome).toUpperCase().replace(/-/g, '_'));
    if (!acao) {
      throw new ValidationError(`Ação desconhecida: ${nome}. Use uma destas: ${[...this.acoes.keys()].join(', ')}`);
    }
    return acao;
  }

  async executar(nome: string, ctx: ContextoTransicao): Promise<ResultadoTransicao> {
    const acao = this.acao(nome);
    await acao.validar(ctx);
    return acao.aplicar(ctx);
  }

  // O que este usuário pode fazer com este pedido agora (a UI só mostra estes botões).
  // Guardas que consultam o banco (ex.: limite de entregas) só são avaliadas ao executar.
  acoesDisponiveis(pedido: Pedido, usuario: Usuario, agora = new Date()): DescricaoAcao[] {
    return [...this.acoes.values()]
      .filter((acao) => acao.saiDe(pedido.status) && acao.podeExecutar(usuario, pedido))
      .map((acao) => acao.descrever(pedido, agora));
  }

  // Tabela completa de transições (alimenta GET /pedidos/maquina-estados e a documentação)
  transicoes(): Transicao[] {
    return [...this.acoes.values()].flatMap((acao) =>
      STATUS_PEDIDO.filter((status) => acao.saiDe(status)).map((origem) => ({
        acao: acao.nome,
        rotulo: acao.rotulo,
        origem,
        destino: acao.destino,
        papeis: acao.papeisPara(origem),
      })),
    );
  }
}

// Composição das ações. Novo caminho no fluxo = nova classe + uma linha aqui.
export function criarMaquinaEstadosPedido(): MaquinaEstadosPedido {
  return new MaquinaEstadosPedido([
    new IniciarPreparoAcao(),
    new MarcarProntoAcao(),
    new DevolverAoPreparoAcao(),
    new DespacharAcao(),
    new ConfirmarEntregaAcao(),
    new CancelarAcao(),
  ]);
}
