import { Produto } from '../../../domain/entities/produto.entity';
import { NotFoundError } from '../../../domain/errors/domain.error';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';

// Os pedidos guardam nome e preço dos itens, então excluir um produto não afeta pedidos já feitos
export class DeleteProdutoUseCase {
  constructor(private readonly produtoRepository: ProdutoRepository) {}

  async execute(id: string): Promise<Produto> {
    const produto = await this.produtoRepository.findById(id);
    if (!produto) {
      throw new NotFoundError(`O produto com o id = ${id} não foi encontrado`);
    }

    await this.produtoRepository.delete(id);
    return produto;
  }
}
