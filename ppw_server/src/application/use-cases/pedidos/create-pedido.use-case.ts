import { DadosEntrega, Pedido } from '../../../domain/entities/pedido.entity';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { PublicadorEventos } from '../../ports/publicador-eventos';
import { UnitOfWork } from '../../ports/unit-of-work';
import { montarItensPedido } from './montar-itens-pedido';

export interface CreatePedidoInput extends DadosEntrega {
  itens: unknown;
}

export class CreatePedidoUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly publicador: PublicadorEventos,
  ) {}

  async execute(input: CreatePedidoInput, usuario: Usuario): Promise<Pedido> {
    usuario.exigirPapel(['ATENDENTE', 'GERENTE'], 'lançar pedidos');

    // Uma transação: se faltar estoque de qualquer item, nada é gravado (nem o pedido,
    // nem as baixas dos itens anteriores, nem o histórico).
    const pedido = await this.uow.executar(async (repos) => {
      const itens = await montarItensPedido(input.itens, repos.produtos);
      const pedido = Pedido.criar(input, itens, usuario.id);
      await repos.pedidos.create(pedido);

      // Ordem fixa por produtoId: duas vendas simultâneas travam as linhas de produto
      // na mesma ordem, o que evita deadlock no PostgreSQL.
      const comEstoque = itens.filter((item) => item.reservaEstoque).sort((a, b) => a.produtoId.localeCompare(b.produtoId));
      for (const item of comEstoque) {
        await repos.estoque.reservar(item.produtoId, item.quantidade, {
          pedidoId: pedido.id,
          autorId: usuario.id,
          motivo: `Venda no pedido #${pedido.numero}`,
        });
      }

      await repos.historico.registrar({
        pedidoId: pedido.id,
        acao: 'CRIAR',
        estadoAnterior: null,
        novoEstado: pedido.status,
        autorId: usuario.id,
        justificativa: null,
        detalhes: { itens: itens.map((i) => `${i.quantidade}x ${i.nome}`), total: pedido.total },
      });

      return pedido;
    });

    this.publicador.publicar({
      tipo: 'PEDIDO_CRIADO',
      pedidoId: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      versao: pedido.versao,
      acao: 'CRIAR',
      ocorridoEm: new Date().toISOString(),
    });
    return pedido;
  }
}
