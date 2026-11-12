import { Produto } from '../../src/domain/entities/produto.entity';
import { ProdutoRepository } from '../../src/domain/repositories/produto.repository';

// Implementação em memória do contrato, usada nos testes no lugar do arquivo JSON
export class InMemoryProdutoRepository implements ProdutoRepository {
  produtos: Produto[] = [];

  async findAll(): Promise<Produto[]> {
    return [...this.produtos];
  }

  async findById(id: string): Promise<Produto | null> {
    return this.produtos.find((p) => p.id === id) ?? null;
  }

  async create(produto: Produto): Promise<void> {
    this.produtos.push(produto);
  }

  async update(produto: Produto): Promise<void> {
    this.produtos = this.produtos.map((p) => (p.id === produto.id ? produto : p));
  }

  async delete(id: string): Promise<void> {
    this.produtos = this.produtos.filter((p) => p.id !== id);
  }
}
