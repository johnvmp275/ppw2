import { ValidationError } from '../errors/domain.error';
import { arredondarMoeda } from '../shared/normalizar';

export interface ItemPedidoProps {
  produtoId: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
}

// Objeto de valor: não tem id próprio e não muda depois de criado.
// Guarda o nome e o preço do produto no momento da venda, para o pedido
// não mudar de valor quando o cardápio for alterado.
export class ItemPedido {
  private constructor(
    readonly produtoId: string,
    readonly nome: string,
    readonly precoUnitario: number,
    readonly quantidade: number,
  ) {}

  static criar(props: ItemPedidoProps): ItemPedido {
    const quantidade = Number(props.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw new ValidationError(`Quantidade inválida para o produto ${props.nome}`);
    }
    return new ItemPedido(props.produtoId, props.nome, props.precoUnitario, quantidade);
  }

  get subtotal(): number {
    return arredondarMoeda(this.precoUnitario * this.quantidade);
  }
}
