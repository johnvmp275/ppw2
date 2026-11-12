import { DadosProduto, Produto } from '../../../domain/entities/produto.entity';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';

export class CreateProdutoUseCase {
  constructor(private readonly produtoRepository: ProdutoRepository) {}

  async execute(dados: DadosProduto): Promise<Produto> {
    const produto = Produto.criar(dados);
    await this.produtoRepository.create(produto);
    return produto;
  }
}
