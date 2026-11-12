import { ConflitoError, RegraNegocioError } from '../../../../domain/errors/domain.error';
import { EstoqueRepository, Movimentacao } from '../../../../domain/repositories/estoque.repository';
import { Sql } from '../database';

type Tipo = 'RESERVA' | 'DEVOLUCAO' | 'AJUSTE';

export class PgEstoqueRepository implements EstoqueRepository {
  constructor(private readonly sql: Sql) {}

  // Verificar e baixar em UM comando: o "estoque >= $2" e o "estoque - $2" acontecem
  // atomicamente na mesma linha travada. Não existe janela entre "ler" e "gravar"
  // para outra venda passar no meio. Se não houver estoque, nenhuma linha é afetada.
  async reservar(produtoId: string, quantidade: number, mov: Movimentacao): Promise<void> {
    const { rows } = await this.sql.query<{ estoque: number }>(
      `UPDATE produtos SET estoque = estoque - $2, atualizado_em = now()
        WHERE id = $1 AND estoque IS NOT NULL AND estoque >= $2
       RETURNING estoque`,
      [produtoId, quantidade],
    );

    if (rows.length === 0) {
      const { rows: atual } = await this.sql.query<{ nome: string; estoque: number | null }>(
        'SELECT nome, estoque FROM produtos WHERE id = $1',
        [produtoId],
      );
      throw new ConflitoError(
        `Estoque insuficiente de ${atual[0]?.nome ?? 'produto'}: pedido ${quantidade}, disponível ${atual[0]?.estoque ?? 0}`,
      );
    }
    await this.registrar(produtoId, 'RESERVA', -quantidade, rows[0].estoque, mov);
  }

  async devolver(produtoId: string, quantidade: number, mov: Movimentacao): Promise<void> {
    const { rows } = await this.sql.query<{ estoque: number }>(
      `UPDATE produtos SET estoque = estoque + $2, atualizado_em = now()
        WHERE id = $1 AND estoque IS NOT NULL
       RETURNING estoque`,
      [produtoId, quantidade],
    );
    if (rows.length > 0) {
      await this.registrar(produtoId, 'DEVOLUCAO', quantidade, rows[0].estoque, mov);
    }
  }

  async ajustar(produtoId: string, delta: number, mov: Movimentacao): Promise<number> {
    const { rows } = await this.sql.query<{ estoque: number }>(
      `UPDATE produtos SET estoque = estoque + $2, atualizado_em = now()
        WHERE id = $1 AND estoque IS NOT NULL AND estoque + $2 >= 0
       RETURNING estoque`,
      [produtoId, delta],
    );
    if (rows.length === 0) {
      throw new RegraNegocioError('O ajuste deixaria o estoque negativo');
    }
    await this.registrar(produtoId, 'AJUSTE', delta, rows[0].estoque, mov);
    return rows[0].estoque;
  }

  private async registrar(produtoId: string, tipo: Tipo, quantidade: number, saldo: number, mov: Movimentacao) {
    await this.sql.query(
      `INSERT INTO movimentacoes_estoque (produto_id, pedido_id, tipo, quantidade, saldo_apos, autor_id, motivo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [produtoId, mov.pedidoId, tipo, quantidade, saldo, mov.autorId, mov.motivo],
    );
  }
}
