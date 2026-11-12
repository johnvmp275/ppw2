import { Produto } from '../../../domain/entities/produto.entity';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { NotFoundError } from '../../../domain/errors/domain.error';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';

// Exclusão lógica: o produto sai do cardápio, mas a linha continua no banco porque
// itens de pedidos antigos têm chave estrangeira para ela (ON DELETE RESTRICT).
export class DeleteProdutoUseCase {
  constructor(private readonly produtoRepository: ProdutoRepository) {}

  async execute(id: string, usuario: Usuario): Promise<Produto> {
    usuario.exigirPapel(['GERENTE'], 'remover produtos do cardápio');
    const produto = await this.produtoRepository.findById(id);
    if (!produto || !produto.ativo) {
      throw new NotFoundError(`O produto com o id = ${id} não foi encontrado`);
    }

    await this.produtoRepository.desativar(id);
    return produto;
  }
}
