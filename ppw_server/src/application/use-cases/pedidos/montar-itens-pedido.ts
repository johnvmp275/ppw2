import { ValidationError } from '../../../domain/errors/domain.error';
import { ProdutoRepository } from '../../../domain/repositories/produto.repository';
import { ItemPedido } from '../../../domain/value-objects/item-pedido';

export interface ItemPedidoInput {
  produtoId: string;
  quantidade: number;
}

// Transforma o que o cliente enviou ({ produtoId, quantidade }) em itens do pedido.
// Preço, tempo de preparo e "controla estoque" vêm do cadastro de produtos, nunca do cliente.
// Na edição, itens que o pedido já tinha mantêm o que foi registrado na venda.
export async function montarItensPedido(
  entrada: unknown,
  produtoRepository: ProdutoRepository,
  itensAtuais: readonly ItemPedido[] = [],
): Promise<ItemPedido[]> {
  if (!Array.isArray(entrada)) {
    return [];
  }

  const pedidos = entrada.map((item: Partial<ItemPedidoInput> | null) => {
    if (!item || typeof item.produtoId !== 'string' || !item.produtoId) {
      throw new ValidationError('Cada item precisa de um produtoId');
    }
    return { produtoId: item.produtoId, quantidade: Number(item.quantidade) };
  });

  // Uma única consulta para todos os produtos do pedido (sem N+1)
  const produtos = await produtoRepository.findByIds([...new Set(pedidos.map((item) => item.produtoId))]);

  return pedidos.map((item) => {
    const produto = produtos.find((p) => p.id === item.produtoId);
    const itemAtual = itensAtuais.find((i) => i.produtoId === item.produtoId);

    if (itemAtual) {
      if (item.quantidade > itemAtual.quantidade && !produto?.ativo) {
        throw new ValidationError(`${itemAtual.nome} saiu do cardápio: não dá para aumentar a quantidade`);
      }
      return itemAtual.comQuantidade(item.quantidade);
    }

    if (!produto || !produto.ativo) {
      throw new ValidationError(`O produto com o id = ${item.produtoId} não existe ou saiu do cardápio`);
    }

    return ItemPedido.criar({
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: produto.preco,
      quantidade: item.quantidade,
      tempoPreparoMin: produto.tempoPreparoMin,
      reservaEstoque: produto.controlaEstoque,
    });
  });
}
