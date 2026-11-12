import { Produto } from '../entities/produto.entity';

// Contrato de persistência. O domínio só conhece esta classe abstrata;
// a implementação (PostgreSQL) fica na infraestrutura.
// Classe abstrata em vez de interface porque o Nest consegue usá-la como token de injeção.
export abstract class ProdutoRepository {
  // Só produtos ativos (os desativados continuam no banco porque pedidos antigos apontam para eles)
  abstract findAll(): Promise<Produto[]>;
  abstract findById(id: string): Promise<Produto | null>;
  // Uma consulta só (WHERE id = ANY($1)) em vez de uma por item: evita N+1
  abstract findByIds(ids: string[]): Promise<Produto[]>;
  abstract create(produto: Produto): Promise<void>;
  abstract update(produto: Produto): Promise<void>;
  abstract desativar(id: string): Promise<void>;
}
