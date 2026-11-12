// Formato do corpo das requisições. As regras ficam no domínio (entidade, máquina de estados, política).
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

// Adicionais/remoções e dados de entrega. "status" não é aceito: se vier, a API responde 422.
export class UpdatePedidoDto extends CreatePedidoDto {
  versao!: number;
  justificativa?: string;
  status?: unknown;
}

// POST /pedidos/:id/acoes/:acao
export class ExecutarAcaoDto {
  versao!: number;
  justificativa?: string;
}
