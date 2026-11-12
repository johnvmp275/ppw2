import {
  HistoricoRepository,
  LeadTimeEtapa,
  NovoRegistroHistorico,
  RegistroHistorico,
} from '../../../../domain/repositories/historico.repository';
import { StatusPedido } from '../../../../domain/value-objects/status-pedido';
import { Sql } from '../database';

interface HistoricoRow {
  id: string;
  pedido_id: string;
  acao: string;
  estado_anterior: StatusPedido | null;
  novo_estado: StatusPedido;
  autor_id: string;
  autor_nome: string;
  autor_papel: string;
  justificativa: string | null;
  detalhes: Record<string, unknown> | null;
  criado_em: Date;
}

export class PgHistoricoRepository implements HistoricoRepository {
  constructor(private readonly sql: Sql) {}

  async registrar(registro: NovoRegistroHistorico): Promise<void> {
    await this.sql.query(
      `INSERT INTO pedido_historico (pedido_id, acao, estado_anterior, novo_estado, autor_id, justificativa, detalhes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        registro.pedidoId,
        registro.acao,
        registro.estadoAnterior,
        registro.novoEstado,
        registro.autorId,
        registro.justificativa,
        registro.detalhes ? JSON.stringify(registro.detalhes) : null,
      ],
    );
  }

  async listarPorPedido(pedidoId: string): Promise<RegistroHistorico[]> {
    const { rows } = await this.sql.query<HistoricoRow>(
      `SELECT h.*, u.nome AS autor_nome, u.papel AS autor_papel
         FROM pedido_historico h
         JOIN usuarios u ON u.id = h.autor_id
        WHERE h.pedido_id = $1
        ORDER BY h.id`,
      [pedidoId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      pedidoId: row.pedido_id,
      acao: row.acao,
      estadoAnterior: row.estado_anterior,
      novoEstado: row.novo_estado,
      autorId: row.autor_id,
      autorNome: row.autor_nome,
      autorPapel: row.autor_papel,
      justificativa: row.justificativa,
      detalhes: typeof row.detalhes === 'string' ? JSON.parse(row.detalhes) : row.detalhes,
      criadoEm: new Date(row.criado_em),
    }));
  }

  // Cada linha da trilha que muda de etapa marca a ENTRADA numa etapa; a próxima
  // linha do mesmo pedido (LEAD) marca a SAÍDA. A diferença é o tempo naquela coluna.
  async leadTimePorEtapa(): Promise<LeadTimeEtapa[]> {
    const { rows } = await this.sql.query<{ status: StatusPedido; pedidos: number; media_min: number; maximo_min: number }>(
      `WITH etapas AS (
         SELECT h.pedido_id,
                h.novo_estado AS status,
                h.criado_em AS entrou_em,
                LEAD(h.criado_em) OVER (PARTITION BY h.pedido_id ORDER BY h.id) AS saiu_em
           FROM pedido_historico h
          WHERE h.estado_anterior IS DISTINCT FROM h.novo_estado
       )
       SELECT status,
              count(DISTINCT pedido_id)::int AS pedidos,
              round(avg(extract(epoch FROM saiu_em - entrou_em) / 60)::numeric, 1)::float8 AS media_min,
              round(max(extract(epoch FROM saiu_em - entrou_em) / 60)::numeric, 1)::float8 AS maximo_min
         FROM etapas
        WHERE saiu_em IS NOT NULL
        GROUP BY status
        ORDER BY array_position(ARRAY['RECEBIDO', 'EM_PREPARO', 'PRONTO_PARA_RETIRADA', 'EM_ROTA_DE_ENTREGA'], status)`,
    );
    return rows.map((r) => ({
      status: r.status,
      pedidos: r.pedidos,
      mediaMin: Number(r.media_min),
      maximoMin: Number(r.maximo_min),
    }));
  }
}
