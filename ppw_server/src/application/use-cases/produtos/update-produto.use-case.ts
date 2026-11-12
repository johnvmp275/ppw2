import { DadosProduto, Produto } from '../../../domain/entities/produto.entity';
import { NotFoundError } from '../../../domain/errors/domain.error';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';

export class UpdateProdutoUseCase {
  constructor(private readonly produtoRepository: ProdutoRepository) {}

  async execute(id: string, dados: DadosProduto): Promise<Produto> {
    const produto = await this.produtoRepository.findById(id);
    if (!produto) {
      throw new NotFoundError(`O produto com o id = ${id} não foi encontrado`);
    }

    produto.atualizar(dados);
    await this.produtoRepository.update(produto);
    return produto;
  }
}
