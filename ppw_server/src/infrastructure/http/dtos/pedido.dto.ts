// Formato do corpo das requisições. As regras ficam na entidade Pedido.
export class ItemPedidoDto {
  produtoId!: string;
  quantidade!: number;
}

export class CreatePedidoDto {
  cliente!: string;
  telefone?: string;
  endereco!: string;
  observacao?: string;
  itens!: ItemPedidoDto[];
}

export class UpdatePedidoDto extends CreatePedidoDto {
  status?: string;
}

export class UpdatePedidoStatusDto {
  status!: string;
}
