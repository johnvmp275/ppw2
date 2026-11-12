import { Produto } from '../../../domain/entities/produto.entity';

// Define o JSON que a API devolve. A entidade guarda os dados em campos privados,
// então ela precisa ser convertida em um objeto simples antes de ir para o cliente.
export class ProdutoPresenter {
  static toHttp(produto: Produto) {
    return {
      id: produto.id,
      nome: produto.nome,
      descricao: produto.descricao,
      categoria: produto.categoria,
      preco: produto.preco,
      criadoEm: produto.criadoEm.toISOString(),
      atualizadoEm: produto.atualizadoEm.toISOString(),
    };
  }
}
