import { DadosProduto, Produto } from '../../../domain/entities/produto.entity';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { NotFoundError } from '../../../domain/errors/domain.error';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';

// Altera nome, preço, categoria e tempo de preparo. O estoque NÃO é alterado aqui:
// gravar um número digitado no formulário apagaria as vendas feitas enquanto o
// gerente editava (lost update). Para estoque existe o ajuste relativo (AjustarEstoqueUseCase).
export class UpdateProdutoUseCase {
  constructor(private readonly produtoRepository: ProdutoRepository) {}

  async execute(id: string, dados: DadosProduto, usuario: Usuario): Promise<Produto> {
    usuario.exigirPapel(['GERENTE'], 'alterar produtos');
    const produto = await this.produtoRepository.findById(id);
    if (!produto || !produto.ativo) {
      throw new NotFoundError(`O produto com o id = ${id} não foi encontrado`);
    }

    produto.atualizar(dados);
    await this.produtoRepository.update(produto);
    return produto;
  }
}
