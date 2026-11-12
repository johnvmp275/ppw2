export interface Movimentacao {
  pedidoId: string | null;
  autorId: string;
  motivo: string;
}

// Toda operação é um UPDATE relativo e atômico (estoque = estoque - :qtd WHERE estoque >= :qtd),
// nunca "ler, calcular e gravar o valor". Cada movimento fica registrado em movimentacoes_estoque.
export abstract class EstoqueRepository {
  // Lança ConflitoError se não houver estoque suficiente
  abstract reservar(produtoId: string, quantidade: number, mov: Movimentacao): Promise<void>;
  abstract devolver(produtoId: string, quantidade: number, mov: Movimentacao): Promise<void>;
  // Entrada (delta > 0) ou baixa manual (delta < 0). Devolve o estoque final.
  abstract ajustar(produtoId: string, delta: number, mov: Movimentacao): Promise<number>;
}
