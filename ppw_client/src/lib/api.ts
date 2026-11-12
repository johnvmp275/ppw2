import { API_URL, ERRO_CONEXAO, Pedido, PedidoInput, Produto, ProdutoInput, StatusPedido, lerErro } from "@/lib/delivery";

// Todas as chamadas à API Nest passam por aqui.
// Se a resposta não for 2xx, lança um Error com a mensagem que o servidor devolveu.
async function request<T>(caminho: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${caminho}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error(ERRO_CONEXAO);
  }

  if (!response.ok) throw new Error(await lerErro(response));
  return response.json();
}

export const produtosApi = {
  listar: () => request<Produto[]>("/produtos"),
  buscar: (id: string) => request<Produto>(`/produtos/${id}`),
  criar: (dados: ProdutoInput) =>
    request<Produto>("/produtos", { method: "POST", body: JSON.stringify(dados) }),
  atualizar: (id: string, dados: ProdutoInput) =>
    request<Produto>(`/produtos/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  excluir: (id: string) => request<{ message: string }>(`/produtos/${id}`, { method: "DELETE" }),
};

export const pedidosApi = {
  listar: () => request<Pedido[]>("/pedidos"),
  buscar: (id: string) => request<Pedido>(`/pedidos/${id}`),
  criar: (dados: PedidoInput) =>
    request<Pedido>("/pedidos", { method: "POST", body: JSON.stringify(dados) }),
  atualizar: (id: string, dados: PedidoInput) =>
    request<Pedido>(`/pedidos/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  alterarStatus: (id: string, status: StatusPedido) =>
    request<Pedido>(`/pedidos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  excluir: (id: string) => request<{ message: string }>(`/pedidos/${id}`, { method: "DELETE" }),
};
