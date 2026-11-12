import { RepositoriosTransacao, UnitOfWork } from '../../../application/ports/unit-of-work';
import { Database } from './database';
import { PgEstoqueRepository } from './repositories/pg-estoque.repository';
import { PgHistoricoRepository } from './repositories/pg-historico.repository';
import { PgPedidoRepository } from './repositories/pg-pedido.repository';
import { PgProdutoRepository } from './repositories/pg-produto.repository';

// Abre uma transação e entrega repositórios que usam a conexão dela.
// Assim pedido, itens, estoque e histórico são gravados (ou desfeitos) juntos.
export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly database: Database) {}

  executar<T>(trabalho: (repos: RepositoriosTransacao) => Promise<T>): Promise<T> {
    return this.database.transaction((sql) =>
      trabalho({
        pedidos: new PgPedidoRepository(sql),
        produtos: new PgProdutoRepository(sql),
        estoque: new PgEstoqueRepository(sql),
        historico: new PgHistoricoRepository(sql),
      }),
    );
  }
}
