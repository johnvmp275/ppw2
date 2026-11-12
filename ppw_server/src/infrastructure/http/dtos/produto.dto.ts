// Formato do corpo das requisições. As regras (nome obrigatório, preço > 0...)
// ficam na entidade Produto, então aqui só descrevemos os campos.
export class CreateProdutoDto {
  nome!: string;
  descricao?: string;
  categoria?: string;
  preco!: number;
}

export class UpdateProdutoDto extends CreateProdutoDto {}
