// Formato do corpo das requisições. As regras (nome obrigatório, preço > 0...)
// ficam na entidade Produto, então aqui só descrevemos os campos.
export class UpdateProdutoDto {
  nome!: string;
  descricao?: string;
  categoria?: string;
  preco!: number;
  tempoPreparoMin?: number;
}

export class CreateProdutoDto extends UpdateProdutoDto {
  // Vazio = feito na hora (sem controle de estoque)
  estoqueInicial?: number | null;
}

export class AjusteEstoqueDto {
  delta!: number;
  motivo?: string;
}
