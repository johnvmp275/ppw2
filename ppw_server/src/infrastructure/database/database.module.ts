import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { join } from 'path';
import { UnitOfWork } from '../../application/ports/unit-of-work';
import { HistoricoRepository } from '../../domain/repositories/historico.repository';
import { PedidoRepository } from '../../domain/repositories/pedido.repository';
import { ProdutoRepository } from '../../domain/repositories/produto.repository';
import { UsuarioRepository } from '../../domain/repositories/usuario.repository';
import { Database, PgDatabase, PgliteDatabase } from './postgres/database';
import { migrar } from './postgres/migrator';
import { PgUnitOfWork } from './postgres/pg-unit-of-work';
import { PgHistoricoRepository } from './postgres/repositories/pg-historico.repository';
import { PgPedidoRepository } from './postgres/repositories/pg-pedido.repository';
import { PgProdutoRepository } from './postgres/repositories/pg-produto.repository';
import { PgUsuarioRepository } from './postgres/repositories/pg-usuario.repository';

// DATABASE_URL definida -> PostgreSQL de verdade (servidor do laboratório ou docker compose),
//                          no schema indicado por ?schema=
// sem DATABASE_URL     -> PGlite gravando em data/pglite (ou PGLITE_DIR=memory:// nos testes)
async function abrirBanco(): Promise<Database> {
  let database: Database;
  if (process.env.DATABASE_URL) {
    const pg = new PgDatabase(process.env.DATABASE_URL);
    await pg.criarSchemaSeNaoExistir();
    database = pg;
  } else {
    database = await PgliteDatabase.abrir(process.env.PGLITE_DIR ?? join(process.cwd(), 'data', 'pglite'));
  }

  await migrar(database, { seed: process.env.SEED !== 'false' });
  return database;
}

// Liga os contratos do domínio às implementações concretas (PostgreSQL).
// Repositórios injetados direto usam o pool (leituras simples);
// escritas que precisam de atomicidade passam pelo UnitOfWork.
@Global()
@Module({
  providers: [
    { provide: Database, useFactory: abrirBanco },
    { provide: ProdutoRepository, useFactory: (db: Database) => new PgProdutoRepository(db), inject: [Database] },
    { provide: PedidoRepository, useFactory: (db: Database) => new PgPedidoRepository(db), inject: [Database] },
    { provide: HistoricoRepository, useFactory: (db: Database) => new PgHistoricoRepository(db), inject: [Database] },
    { provide: UsuarioRepository, useFactory: (db: Database) => new PgUsuarioRepository(db), inject: [Database] },
    { provide: UnitOfWork, useFactory: (db: Database) => new PgUnitOfWork(db), inject: [Database] },
  ],
  exports: [Database, ProdutoRepository, PedidoRepository, HistoricoRepository, UsuarioRepository, UnitOfWork],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(Database) private readonly database: Database) {}

  async onApplicationShutdown() {
    await this.database.close();
  }
}
