import { Produto } from '../../../domain/entities/produto.entity';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';

export class FindAllProdutosUseCase {
  constructor(private readonly produtoRepository: ProdutoRepository) {}

  execute(): Promise<Produto[]> {
    return this.produtoRepository.findAll();
  }
}
