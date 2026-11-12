import { ValidationError } from '../errors/domain.error';
import { arredondarMoeda } from '../shared/normalizar';

export interface ItemPedidoProps {
  produtoId: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
  // Tempo de preparo do produto no momento da venda (base do SLA da cozinha)
  tempoPreparoMin: number;
  // true quando a venda baixou o estoque do produto (bebida em lata, sobremesa pronta...).
  // É isso que diz se o item volta para o estoque num cancelamento.
  reservaEstoque: boolean;
}

// Objeto de valor: não tem id próprio e não muda depois de criado.
// Guarda nome, preço e tempo de preparo do produto no momento da venda, para o pedido
// não mudar quando o cardápio for alterado.
export class ItemPedido {
  private constructor(private readonly props: ItemPedidoProps) {}

  static criar(props: ItemPedidoProps): ItemPedido {
    const quantidade = Number(props.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw new ValidationError(`Quantidade inválida para o produto ${props.nome}`);
    }
    return new ItemPedido({ ...props, quantidade });
  }

  comQuantidade(quantidade: number): ItemPedido {
    return ItemPedido.criar({ ...this.props, quantidade });
  }

  get produtoId() {
    return this.props.produtoId;
  }

  get nome() {
    return this.props.nome;
  }

  get precoUnitario() {
    return this.props.precoUnitario;
  }

  get quantidade() {
    return this.props.quantidade;
  }

  get tempoPreparoMin() {
    return this.props.tempoPreparoMin;
  }

  get reservaEstoque() {
    return this.props.reservaEstoque;
  }

  get subtotal(): number {
    return arredondarMoeda(this.precoUnitario * this.quantidade);
  }
}
