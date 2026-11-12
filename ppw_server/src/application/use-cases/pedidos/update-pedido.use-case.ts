import { DadosEntrega, Pedido } from '../../../domain/entities/pedido.entity';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { NotFoundError, RegraNegocioError } from '../../../domain/errors/domain.error';
import { PoliticaAlteracaoPedido } from '../../../domain/services/politica-alteracao-pedido';
import { texto } from '../../../domain/shared/normalizar';
import { PublicadorEventos } from '../../ports/publicador-eventos';
import { UnitOfWork } from '../../ports/unit-of-work';
import { montarItensPedido } from './montar-itens-pedido';
import { garantirVersao, lerVersao } from './versao';

export interface UpdatePedidoInput extends DadosEntrega {
  itens: unknown;
  versao: unknown;
  justificativa?: string;
  // Não é aceito: aparece aqui só para podermos recusar explicitamente
  status?: unknown;
}

// Adicionais e remoções. O status NÃO muda por aqui (só pelas ações da máquina de estados).
export class UpdatePedidoUseCase {
  private readonly politica = new PoliticaAlteracaoPedido();

  constructor(
    private readonly uow: UnitOfWork,
    private readonly publicador: PublicadorEventos,
  ) {}

  async execute(id: string, input: UpdatePedidoInput, usuario: Usuario): Promise<Pedido> {
    if (input.status !== undefined) {
      throw new RegraNegocioError(
        'O status não pode ser alterado por formulário. Use a ação correspondente: POST /pedidos/:id/acoes/:acao',
      );
    }
    const versao = lerVersao(input.versao);
    const justificativa = texto(input.justificativa);

    const pedido = await this.uow.executar(async (repos) => {
      const pedido = await repos.pedidos.findByIdParaAtualizar(id);
      if (!pedido) {
        throw new NotFoundError(`O pedido com o id = ${id} não foi encontrado`);
      }
      garantirVersao(pedido, versao);
      this.politica.validar(pedido, usuario, justificativa);

      const itens = await montarItensPedido(input.itens, repos.produtos, pedido.itens);
      const resultado = this.politica.aplicar(pedido, input, itens, new Date());
      const mov = { pedidoId: pedido.id, autorId: usuario.id, motivo: `Alteração do pedido #${pedido.numero}` };

      const porProduto = <T extends { produtoId: string }>(a: T, b: T) => a.produtoId.localeCompare(b.produtoId);
      for (const r of [...resultado.reservas].sort(porProduto)) {
        await repos.estoque.reservar(r.produtoId, r.quantidade, mov);
      }
      for (const d of [...resultado.devolucoes].sort(porProduto)) {
        await repos.estoque.devolver(d.produtoId, d.quantidade, mov);
      }

      await repos.pedidos.update(pedido);
      await repos.historico.registrar({
        pedidoId: pedido.id,
        acao: 'ALTERAR',
        estadoAnterior: pedido.status,
        novoEstado: pedido.status,
        autorId: usuario.id,
        justificativa: justificativa || null,
        detalhes: resultado.detalhes,
      });
      return pedido;
    });

    this.publicador.publicar({
      tipo: 'PEDIDO_ALTERADO',
      pedidoId: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      versao: pedido.versao,
      acao: 'ALTERAR',
      ocorridoEm: new Date().toISOString(),
    });
    return pedido;
  }
}
