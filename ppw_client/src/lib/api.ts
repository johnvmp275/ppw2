import {
  API_URL,
  ApiError,
  ERRO_CONEXAO,
  LeadTimeEtapa,
  Pedido,
  PedidoInput,
  PedidoUpdateInput,
  Produto,
  ProdutoInput,
  RegistroHistorico,
  Usuario,
  lerErro,
} from "@/lib/delivery";
import { getUsuarioId } from "@/lib/sessao";

// Todas as chamadas à API Nest passam por aqui.
// Se a resposta não for 2xx, lança um ApiError com a mensagem e o código que o servidor devolveu.
async function request<T>(caminho: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${caminho}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": getUsuarioId(),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(ERRO_CONEXAO, 0);
  }

  if (!response.ok) throw new ApiError(await lerErro(response), response.status);
  return response.json();
}

// "INICIAR_PREPARO" -> "iniciar-preparo" (formato da URL)
const slug = (acao: string) => acao.toLowerCase().replace(/_/g, "-");

export const usuariosApi = {
  listar: () => request<Usuario[]>("/usuarios"),
};

export const produtosApi = {
  listar: () => request<Produto[]>("/produtos"),
  buscar: (id: string) => request<Produto>(`/produtos/${id}`),
  criar: (dados: ProdutoInput) =>
    request<Produto>("/produtos", { method: "POST", body: JSON.stringify(dados) }),
  atualizar: (id: string, dados: ProdutoInput) =>
    request<Produto>(`/produtos/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  ajustarEstoque: (id: string, delta: number, motivo: string) =>
    request<Produto>(`/produtos/${id}/estoque`, { method: "POST", body: JSON.stringify({ delta, motivo }) }),
  excluir: (id: string) => request<{ message: string }>(`/produtos/${id}`, { method: "DELETE" }),
};

export const pedidosApi = {
  listar: () => request<Pedido[]>("/pedidos"),
  buscar: (id: string) => request<Pedido>(`/pedidos/${id}`),
  historico: (id: string) => request<RegistroHistorico[]>(`/pedidos/${id}/historico`),
  leadTime: () => request<LeadTimeEtapa[]>("/pedidos/metricas/lead-time"),
  criar: (dados: PedidoInput) =>
    request<Pedido>("/pedidos", { method: "POST", body: JSON.stringify(dados) }),
  atualizar: (id: string, dados: PedidoUpdateInput) =>
    request<Pedido>(`/pedidos/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  // A única forma de mudar o status: executar uma ação da máquina de estados
  executarAcao: (pedido: Pedido, acao: string, justificativa?: string) =>
    request<Pedido>(`/pedidos/${pedido.id}/acoes/${slug(acao)}`, {
      method: "POST",
      body: JSON.stringify({ versao: pedido.versao, justificativa }),
    }),
};

export interface Acompanhamento {
  id: string;
  numero: number;
  cliente: string;
  itens: { nome: string; quantidade: number }[];
  total: number;
  status: Pedido["status"];
  prazoPreparoEm: string | null;
  atrasado: boolean;
  linhaDoTempo: { status: Pedido["status"]; em: string }[];
}

export const acompanhamentoApi = {
  buscar: (id: string) => request<Acompanhamento>(`/acompanhamento/${id}`),
};
