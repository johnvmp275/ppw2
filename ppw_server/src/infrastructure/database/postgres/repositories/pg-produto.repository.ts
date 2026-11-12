import { Produto } from '../../../../domain/entities/produto.entity';
import { ProdutoRepository } from '../../../../domain/repositories/produto.repository';
import { Sql } from '../database';
import { ehUuid } from './uuid';

interface ProdutoRow {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  preco: string;
  tempo_preparo_min: number;
  estoque: number | null;
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

const SELECT_PRODUTO = `
  SELECT p.id, p.nome, p.descricao, c.nome AS categoria, p.preco, p.tempo_preparo_min,
         p.estoque, p.ativo, p.criado_em, p.atualizado_em
    FROM produtos p
    JOIN categorias c ON c.id = p.categoria_id`;

function toDomain(row: ProdutoRow): Produto {
  return Produto.restaurar(row.id, {
    nome: row.nome,
    descricao: row.descricao,
    categoria: row.categoria,
    // NUMERIC chega como texto para não perder precisão
    preco: Number(row.preco),
    tempoPreparoMin: row.tempo_preparo_min,
    estoque: row.estoque === null ? null : Number(row.estoque),
    ativo: row.ativo,
    criadoEm: new Date(row.criado_em),
    atualizadoEm: new Date(row.atualizado_em),
  });
}

export class PgProdutoRepository implements ProdutoRepository {
  constructor(private readonly sql: Sql) {}

  async findAll(): Promise<Produto[]> {
    const { rows } = await this.sql.query<ProdutoRow>(`${SELECT_PRODUTO} WHERE p.ativo ORDER BY c.nome, p.nome`);
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Produto | null> {
    if (!ehUuid(id)) return null;
    const { rows } = await this.sql.query<ProdutoRow>(`${SELECT_PRODUTO} WHERE p.id = $1`, [id]);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Produto[]> {
    const validos = ids.filter(ehUuid);
    if (validos.length === 0) return [];
    const { rows } = await this.sql.query<ProdutoRow>(`${SELECT_PRODUTO} WHERE p.id = ANY($1::uuid[])`, [validos]);
    return rows.map(toDomain);
  }

  async create(produto: Produto): Promise<void> {
    const categoriaId = await this.categoriaId(produto.categoria);
    await this.sql.query(
      `INSERT INTO produtos (id, categoria_id, nome, descricao, preco, tempo_preparo_min, estoque, ativo, criado_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        produto.id,
        categoriaId,
        produto.nome,
        produto.descricao,
        produto.preco,
        produto.tempoPreparoMin,
        produto.estoque,
        produto.ativo,
        produto.criadoEm,
        produto.atualizadoEm,
      ],
    );
  }

  // Não grava a coluna estoque de propósito (veja UpdateProdutoUseCase)
  async update(produto: Produto): Promise<void> {
    const categoriaId = await this.categoriaId(produto.categoria);
    await this.sql.query(
      `UPDATE produtos
          SET categoria_id = $2, nome = $3, descricao = $4, preco = $5, tempo_preparo_min = $6, atualizado_em = now()
        WHERE id = $1`,
      [produto.id, categoriaId, produto.nome, produto.descricao, produto.preco, produto.tempoPreparoMin],
    );
  }

  async desativar(id: string): Promise<void> {
    await this.sql.query('UPDATE produtos SET ativo = FALSE, atualizado_em = now() WHERE id = $1', [id]);
  }

  // Categoria normalizada em tabela própria; cria na hora se ainda não existir.
  // O "DO UPDATE" sem mudança real é o jeito de o RETURNING devolver o id também quando já existe.
  private async categoriaId(nome: string): Promise<number> {
    const { rows } = await this.sql.query<{ id: number }>(
      `INSERT INTO categorias (nome) VALUES ($1)
       ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [nome],
    );
    return rows[0].id;
  }
}
