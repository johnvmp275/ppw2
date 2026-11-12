import { Pedido } from '../../../domain/entities/pedido.entity';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { NotFoundError } from '../../../domain/errors/domain.error';
import { texto } from '../../../domain/shared/normalizar';
import { MaquinaEstadosPedido } from '../../../domain/state-machine/maquina-estados-pedido';
import { PublicadorEventos } from '../../ports/publicador-eventos';
import { UnitOfWork } from '../../ports/unit-of-work';
import { garantirVersao, lerVersao } from './versao';

export interface ExecutarAcaoInput {
  pedidoId: string;
  acao: string;
  versao: unknown;
  justificativa?: unknown;
}

// Única porta de entrada para mudar o status de um pedido.
//
// Tudo dentro de UMA transação:
//   1. SELECT ... FOR UPDATE no pedido (ninguém mais mexe nele até o COMMIT)
//   2. confere a versão que o usuário viu (409 se mudou)
//   3. máquina de estados: origem -> permissão -> justificativa -> guarda -> efeitos
//   4. devolve estoque (se for cancelamento)
//   5. UPDATE ... WHERE versao = :versao
//   6. INSERT na trilha de auditoria
// Qualquer erro em qualquer passo = ROLLBACK de tudo.
export class ExecutarAcaoPedidoUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly maquina: MaquinaEstadosPedido,
    private readonly publicador: PublicadorEventos,
    private readonly relogio: () => Date = () => new Date(),
  ) {}

  async execute(input: ExecutarAcaoInput, usuario: Usuario): Promise<Pedido> {
    const acao = this.maquina.acao(input.acao);
    const versao = lerVersao(input.versao);
    const justificativa = texto(input.justificativa);

    const pedido = await this.uow.executar(async (repos) => {
      const pedido = await repos.pedidos.findByIdParaAtualizar(input.pedidoId);
      if (!pedido) {
        throw new NotFoundError(`O pedido com o id = ${input.pedidoId} não foi encontrado`);
      }
      garantirVersao(pedido, versao);

      const estadoAnterior = pedido.status;
      const resultado = await this.maquina.executar(acao.nome, {
        pedido,
        usuario,
        justificativa,
        agora: this.relogio(),
        consultas: repos.pedidos,
      });

      for (const devolucao of [...resultado.devolucoesEstoque].sort((a, b) => a.produtoId.localeCompare(b.produtoId))) {
        await repos.estoque.devolver(devolucao.produtoId, devolucao.quantidade, {
          pedidoId: pedido.id,
          autorId: usuario.id,
          motivo: `${acao.rotulo} (pedido #${pedido.numero})`,
        });
      }

      await repos.pedidos.update(pedido);
      await repos.historico.registrar({
        pedidoId: pedido.id,
        acao: acao.nome,
        estadoAnterior,
        novoEstado: pedido.status,
        autorId: usuario.id,
        justificativa: justificativa || null,
        detalhes: resultado.detalhes,
      });
      return pedido;
    });

    this.publicador.publicar({
      tipo: 'PEDIDO_TRANSICIONADO',
      pedidoId: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      versao: pedido.versao,
      acao: acao.nome,
      ocorridoEm: new Date().toISOString(),
    });
    return pedido;
  }
}
