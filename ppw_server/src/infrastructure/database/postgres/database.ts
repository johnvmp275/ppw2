import { PGlite } from '@electric-sql/pglite';
import { Pool, PoolClient } from 'pg';

export interface ResultadoSql<T> {
  rows: T[];
  // Linhas afetadas por INSERT/UPDATE/DELETE (usado no bloqueio otimista)
  linhasAfetadas: number;
}

// O mínimo que um repositório precisa: mandar SQL parametrizado ($1, $2...).
// Nunca concatenamos valores no SQL: tudo vai como parâmetro (sem SQL injection).
export interface Sql {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<ResultadoSql<T>>;
}

// Duas implementações com o MESMO SQL (dialeto PostgreSQL):
//  - PgDatabase: PostgreSQL de verdade (docker compose), quando DATABASE_URL existe
//  - PgliteDatabase: PostgreSQL compilado para WebAssembly, roda dentro do Node sem instalar nada.
//    Usado no desenvolvimento local e nos testes.
export abstract class Database implements Sql {
  abstract query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<ResultadoSql<T>>;
  // BEGIN ... COMMIT; se a função lançar erro, ROLLBACK
  abstract transaction<T>(trabalho: (sql: Sql) => Promise<T>): Promise<T>;
  // Roda um script com vários comandos (migrações)
  abstract exec(script: string): Promise<void>;
  abstract close(): Promise<void>;
}

export class PgliteDatabase extends Database {
  private constructor(private readonly db: PGlite) {
    super();
  }

  // dataDir: pasta onde os dados ficam salvos, ou "memory://" para um banco descartável
  static async abrir(dataDir: string): Promise<PgliteDatabase> {
    const db = new PGlite(dataDir);
    await db.waitReady;
    return new PgliteDatabase(db);
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<ResultadoSql<T>> {
    const resultado = await this.db.query<T>(sql, params);
    return { rows: resultado.rows, linhasAfetadas: resultado.affectedRows ?? 0 };
  }

  // O PGlite tem uma conexão só e enfileira as transações: duas transações nunca
  // rodam intercaladas. No PostgreSQL real elas rodam em paralelo e quem garante a
  // consistência são o FOR UPDATE, o "WHERE versao = $n" e os UPDATEs atômicos de estoque.
  async transaction<T>(trabalho: (sql: Sql) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) =>
      trabalho({
        query: async <R>(sql: string, params: unknown[] = []) => {
          const resultado = await tx.query<R>(sql, params);
          return { rows: resultado.rows, linhasAfetadas: resultado.affectedRows ?? 0 };
        },
      }),
    );
  }

  async exec(script: string): Promise<void> {
    await this.db.exec(script);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

// Aceita o formato do Prisma: postgresql://usuario:senha@host:5432/banco?schema=meu_schema
// O driver "pg" não entende "?schema=", então ele é retirado da URL e vira o search_path.
export function separarSchema(databaseUrl: string): { connectionString: string; schema: string | null } {
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get('schema');
  url.searchParams.delete('schema');
  if (schema && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Nome de schema inválido em DATABASE_URL: ${schema}`);
  }
  return { connectionString: url.toString(), schema };
}

export class PgDatabase extends Database {
  private readonly pool: Pool;
  readonly schema: string | null;

  constructor(databaseUrl: string) {
    super();
    const { connectionString, schema } = separarSchema(databaseUrl);
    this.schema = schema;
    this.pool = new Pool({ connectionString });
    // Toda conexão nova do pool passa a enxergar só as tabelas do schema do aluno
    // (o nome já foi validado acima, por isso pode ir entre aspas no SQL)
    if (schema) {
      this.pool.on('connect', (client) => {
        void client.query(`SET search_path TO "${schema}"`);
      });
    }
  }

  async criarSchemaSeNaoExistir(): Promise<void> {
    if (this.schema) {
      await this.pool.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`);
    }
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<ResultadoSql<T>> {
    const resultado = await this.pool.query(sql, params);
    return { rows: resultado.rows as T[], linhasAfetadas: resultado.rowCount ?? 0 };
  }

  // Cada transação pega uma conexão exclusiva do pool: BEGIN e COMMIT precisam
  // acontecer na mesma conexão.
  async transaction<T>(trabalho: (sql: Sql) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resultado = await trabalho({
        query: async <R>(sql: string, params: unknown[] = []) => {
          const r = await client.query(sql, params);
          return { rows: r.rows as R[], linhasAfetadas: r.rowCount ?? 0 };
        },
      });
      await client.query('COMMIT');
      return resultado;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async exec(script: string): Promise<void> {
    await this.pool.query(script);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
