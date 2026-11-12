import { Produto } from '../../../domain/entities/produto.entity';
import { NotFoundError } from '../../../domain/errors/domain.error';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';

export class FindProdutoByIdUseCase {
  constructor(private readonly produtoRepository: ProdutoRepository) {}

  async execute(id: string): Promise<Produto> {
    const produto = await this.produtoRepository.findById(id);
    if (!produto) {
      throw new NotFoundError(`O produto com o id = ${id} não foi encontrado`);
    }
    return produto;
  }
}
