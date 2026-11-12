import { Produto } from '../entities/produto.entity';

// Contrato de persistência. O domínio só conhece esta classe abstrata;
// a implementação (arquivo JSON, banco de dados...) fica na infraestrutura.
// Classe abstrata em vez de interface porque o Nest consegue usá-la como token de injeção.
export abstract class ProdutoRepository {
  abstract findAll(): Promise<Produto[]>;
  abstract findById(id: string): Promise<Produto | null>;
  abstract create(produto: Produto): Promise<void>;
  abstract update(produto: Produto): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
