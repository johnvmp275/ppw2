import { DadosNovoProduto, Produto } from '../../../domain/entities/produto.entity';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';

export class CreateProdutoUseCase {
  constructor(private readonly produtoRepository: ProdutoRepository) {}

  async execute(dados: DadosNovoProduto, usuario: Usuario): Promise<Produto> {
    usuario.exigirPapel(['GERENTE'], 'cadastrar produtos');
    const produto = Produto.criar(dados);
    await this.produtoRepository.create(produto);
    return produto;
  }
}
