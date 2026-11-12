import { ValidationError } from '../../../domain/errors/domain.error';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';
import { ItemPedido } from '../../../domain/value-objects/item-pedido';

export interface ItemPedidoInput {
  produtoId: string;
  quantidade: number;
}

// Transforma o que o cliente enviou ({ produtoId, quantidade }) em itens do pedido.
// O preço vem do cadastro de produtos, e não do cliente.
// Na edição, itens que o pedido já tinha mantêm o nome e o preço da época da venda,
// mesmo que o produto tenha mudado de preço ou saído do cardápio.
export async function montarItensPedido(
  entrada: ItemPedidoInput[],
  produtoRepository: ProdutoRepository,
  itensAtuais: readonly ItemPedido[] = [],
): Promise<ItemPedido[]> {
  if (!Array.isArray(entrada)) {
    return [];
  }

  const produtos = await produtoRepository.findAll();

  return entrada.map((item) => {
    const itemAtual = itensAtuais.find((i) => i.produtoId === item.produtoId);
    if (itemAtual) {
      return ItemPedido.criar({
        produtoId: itemAtual.produtoId,
        nome: itemAtual.nome,
        precoUnitario: itemAtual.precoUnitario,
        quantidade: item.quantidade,
      });
    }

    const produto = produtos.find((p) => p.id === item.produtoId);
    if (!produto) {
      throw new ValidationError(`O produto com o id = ${item.produtoId} não existe`);
    }

    return ItemPedido.criar({
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: produto.preco,
      quantidade: item.quantidade,
    });
  });
}
