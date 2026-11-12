import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Database } from './database';

const PASTA_DATABASE = join(process.cwd(), 'database');

// Aplica, em ordem, os arquivos database/migrations/*.sql que ainda não rodaram.
// Cada migração roda dentro de uma transação junto com o registro em schema_migrations.
export async function migrar(database: Database, { seed }: { seed: boolean }) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nome        TEXT PRIMARY KEY,
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const pasta = join(PASTA_DATABASE, 'migrations');
  const arquivos = readdirSync(pasta)
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort();

  const { rows } = await database.query<{ nome: string }>('SELECT nome FROM schema_migrations');
  const aplicadas = new Set(rows.map((r) => r.nome));

  for (const arquivo of arquivos.filter((a) => !aplicadas.has(a))) {
    const script = readFileSync(join(pasta, arquivo), 'utf-8');
    await database.exec(`BEGIN;\n${script}\nINSERT INTO schema_migrations (nome) VALUES ('${arquivo}');\nCOMMIT;`);
  }

  const seedPath = join(PASTA_DATABASE, 'seed.sql');
  if (seed && existsSync(seedPath)) {
    const { rows: usuarios } = await database.query<{ total: number }>('SELECT count(*)::int AS total FROM usuarios');
    if (usuarios[0].total === 0) {
      await database.exec(`BEGIN;\n${readFileSync(seedPath, 'utf-8')}\nCOMMIT;`);
    }
  }
}
