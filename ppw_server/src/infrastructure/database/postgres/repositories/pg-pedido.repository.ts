import { Pedido } from '../../../../domain/entities/pedido.entity';
import { ConflitoError } from '../../../../domain/errors/domain.error';
import { FiltroPedidos, PedidoRepository } from '../../../../domain/repositories/pedido.repository';
import { ItemPedido } from '../../../../domain/value-objects/item-pedido';
import { StatusPedido } from '../../../../domain/value-objects/status-pedido';
import { Sql } from '../database';
import { ehUuid } from './uuid';

interface PedidoRow {
  id: string;
  numero: number;
  cliente: string;
  telefone: string;
  endereco: string;
  observacao: string;
  status: StatusPedido;
  versao: number;
  criado_por_id: string;
  entregador_id: string | null;
  prazo_preparo_em: Date | null;
  valor_perda: string;
  criado_em: Date;
  atualizado_em: Date;
}

interface ItemRow {
  pedido_id: string;
  produto_id: string;
  nome_produto: string;
  preco_unitario: string;
  quantidade: number;
  tempo_preparo_min: number;
  reserva_estoque: boolean;
}

const SELECT_PEDIDO = `
  SELECT id, numero, cliente, telefone, endereco, observacao, status, versao, criado_por_id,
         entregador_id, prazo_preparo_em, valor_perda, criado_em, atualizado_em
    FROM pedidos`;

function toDomain(row: PedidoRow, itens: ItemRow[]): Pedido {
  return Pedido.restaurar(row.id, {
    numero: row.numero,
    cliente: row.cliente,
    telefone: row.telefone,
    endereco: row.endereco,
    observacao: row.observacao,
    status: row.status,
    versao: row.versao,
    criadoPorId: row.criado_por_id,
    entregadorId: row.entregador_id,
    prazoPreparoEm: row.prazo_preparo_em ? new Date(row.prazo_preparo_em) : null,
    valorPerda: Number(row.valor_perda),
    criadoEm: new Date(row.criado_em),
    atualizadoEm: new Date(row.atualizado_em),
    itens: itens.map((item) =>
      ItemPedido.criar({
        produtoId: item.produto_id,
        nome: item.nome_produto,
        precoUnitario: Number(item.preco_unitario),
        quantidade: item.quantidade,
        tempoPreparoMin: item.tempo_preparo_min,
        reservaEstoque: item.reserva_estoque,
      }),
    ),
  });
}

export class PgPedidoRepository implements PedidoRepository {
  constructor(private readonly sql: Sql) {}

  async findAll(filtro: FiltroPedidos = {}): Promise<Pedido[]> {
    const { rows } = await this.sql.query<PedidoRow>(
      `${SELECT_PEDIDO} WHERE ($1::text IS NULL OR status = $1) ORDER BY numero DESC`,
      [filtro.status ?? null],
    );
    return this.comItens(rows);
  }

  async findById(id: string): Promise<Pedido | null> {
    if (!ehUuid(id)) return null;
    const { rows } = await this.sql.query<PedidoRow>(`${SELECT_PEDIDO} WHERE id = $1`, [id]);
    return (await this.comItens(rows))[0] ?? null;
  }

  // Bloqueio pessimista: outra transação que tentar o mesmo FOR UPDATE espera
  // este COMMIT/ROLLBACK e, quando continuar, já lê a versão nova.
  async findByIdParaAtualizar(id: string): Promise<Pedido | null> {
    if (!ehUuid(id)) return null;
    const { rows } = await this.sql.query<PedidoRow>(`${SELECT_PEDIDO} WHERE id = $1 FOR UPDATE`, [id]);
    return (await this.comItens(rows))[0] ?? null;
  }

  async create(pedido: Pedido): Promise<void> {
    const { rows } = await this.sql.query<{ numero: number }>(
      `INSERT INTO pedidos (id, cliente, telefone, endereco, observacao, status, versao, criado_por_id,
                            entregador_id, prazo_preparo_em, valor_perda, criado_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING numero`,
      [
        pedido.id,
        pedido.cliente,
        pedido.telefone,
        pedido.endereco,
        pedido.observacao,
        pedido.status,
        pedido.versao,
        pedido.criadoPorId,
        pedido.entregadorId,
        pedido.prazoPreparoEm,
        pedido.valorPerda,
        pedido.criadoEm,
        pedido.atualizadoEm,
      ],
    );
    pedido.atribuirNumero(rows[0].numero);
    await this.inserirItens(pedido);
  }

  // Bloqueio otimista: o WHERE versao = $n só encontra a linha se ninguém gravou
  // depois da nossa leitura. Zero linhas afetadas = conflito.
  async update(pedido: Pedido): Promise<void> {
    const { linhasAfetadas } = await this.sql.query(
      `UPDATE pedidos
          SET cliente = $3, telefone = $4, endereco = $5, observacao = $6, status = $7,
              entregador_id = $8, prazo_preparo_em = $9, valor_perda = $10,
              atualizado_em = $11, versao = versao + 1
        WHERE id = $1 AND versao = $2`,
      [
        pedido.id,
        pedido.versao,
        pedido.cliente,
        pedido.telefone,
        pedido.endereco,
        pedido.observacao,
        pedido.status,
        pedido.entregadorId,
        pedido.prazoPreparoEm,
        pedido.valorPerda,
        pedido.atualizadoEm,
      ],
    );
    if (linhasAfetadas === 0) {
      throw new ConflitoError(`O pedido #${pedido.numero} foi alterado por outra pessoa. Recarregue e tente de novo`);
    }

    await this.sql.query('DELETE FROM itens_pedido WHERE pedido_id = $1', [pedido.id]);
    await this.inserirItens(pedido);
    pedido.confirmarGravacao();
  }

  // Trava a linha do entregador antes de contar: dois despachos simultâneos do mesmo
  // entregador ficam em fila, e o segundo já enxerga o primeiro na contagem.
  async contarEntregasEmRota(entregadorId: string): Promise<number> {
    await this.sql.query('SELECT id FROM usuarios WHERE id = $1 FOR UPDATE', [entregadorId]);
    const { rows } = await this.sql.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM pedidos WHERE entregador_id = $1 AND status = 'EM_ROTA_DE_ENTREGA'`,
      [entregadorId],
    );
    return rows[0].total;
  }

  private async inserirItens(pedido: Pedido) {
    for (const item of pedido.itens) {
      await this.sql.query(
        `INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, tempo_preparo_min, reserva_estoque)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pedido.id, item.produtoId, item.nome, item.precoUnitario, item.quantidade, item.tempoPreparoMin, item.reservaEstoque],
      );
    }
  }

  // Busca os itens de TODOS os pedidos em uma consulta só (evita N+1)
  private async comItens(rows: PedidoRow[]): Promise<Pedido[]> {
    if (rows.length === 0) return [];
    const { rows: itens } = await this.sql.query<ItemRow>(
      'SELECT * FROM itens_pedido WHERE pedido_id = ANY($1::uuid[]) ORDER BY nome_produto',
      [rows.map((r) => r.id)],
    );
    return rows.map((row) =>
      toDomain(
        row,
        itens.filter((item) => item.pedido_id === row.id),
      ),
    );
  }
}
