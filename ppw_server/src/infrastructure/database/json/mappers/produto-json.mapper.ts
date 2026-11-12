import { Produto } from '../../../../domain/entities/produto.entity';
import { ProdutoRecord } from '../json-database';

// Converte entre a entidade do domínio e o registro gravado no arquivo
export class ProdutoJsonMapper {
  static toDomain(record: ProdutoRecord): Produto {
    return Produto.restaurar(record.id, {
      nome: record.nome,
      descricao: record.descricao ?? '',
      categoria: record.categoria ?? 'Geral',
      preco: record.preco,
      criadoEm: new Date(record.criadoEm),
      atualizadoEm: new Date(record.atualizadoEm ?? record.criadoEm),
    });
  }

  static toRecord(produto: Produto): ProdutoRecord {
    return {
      id: produto.id,
      nome: produto.nome,
      descricao: produto.descricao,
      categoria: produto.categoria,
      preco: produto.preco,
      criadoEm: produto.criadoEm.toISOString(),
      atualizadoEm: produto.atualizadoEm.toISOString(),
    };
  }
}
