import { Papel, Usuario } from '../../../../domain/entities/usuario.entity';
import { UsuarioRepository } from '../../../../domain/repositories/usuario.repository';
import { Sql } from '../database';
import { ehUuid } from './uuid';

interface UsuarioRow {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}

const toDomain = (row: UsuarioRow) => Usuario.restaurar(row.id, { nome: row.nome, papel: row.papel, ativo: row.ativo });

export class PgUsuarioRepository implements UsuarioRepository {
  constructor(private readonly sql: Sql) {}

  async findAll(): Promise<Usuario[]> {
    const { rows } = await this.sql.query<UsuarioRow>(
      `SELECT id, nome, papel, ativo FROM usuarios WHERE ativo
        ORDER BY array_position(ARRAY['ATENDENTE', 'COZINHEIRO', 'ENTREGADOR', 'GERENTE'], papel), nome`,
    );
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Usuario | null> {
    if (!ehUuid(id)) return null;
    const { rows } = await this.sql.query<UsuarioRow>('SELECT id, nome, papel, ativo FROM usuarios WHERE id = $1', [id]);
    return rows[0] ? toDomain(rows[0]) : null;
  }
}
