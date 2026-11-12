import { Injectable } from '@nestjs/common';
import { Produto } from '../../../../domain/entities/produto.entity';
import { ProdutoRepository } from '../../../../domain/repositories/produto.repository';
import { JsonDatabase } from '../json-database';
import { ProdutoJsonMapper } from '../mappers/produto-json.mapper';

@Injectable()
export class JsonProdutoRepository implements ProdutoRepository {
  constructor(private readonly database: JsonDatabase) {}

  async findAll(): Promise<Produto[]> {
    return this.database.listar('produtos').map((record) => ProdutoJsonMapper.toDomain(record));
  }

  async findById(id: string): Promise<Produto | null> {
    const record = this.database.listar('produtos').find((p) => p.id === id);
    return record ? ProdutoJsonMapper.toDomain(record) : null;
  }

  async create(produto: Produto): Promise<void> {
    const records = this.database.listar('produtos');
    records.push(ProdutoJsonMapper.toRecord(produto));
    this.database.salvar('produtos', records);
  }

  async update(produto: Produto): Promise<void> {
    const records = this.database.listar('produtos');
    this.database.salvar(
      'produtos',
      records.map((p) => (p.id === produto.id ? ProdutoJsonMapper.toRecord(produto) : p)),
    );
  }

  async delete(id: string): Promise<void> {
    const records = this.database.listar('produtos');
    this.database.salvar(
      'produtos',
      records.filter((p) => p.id !== id),
    );
  }
}
