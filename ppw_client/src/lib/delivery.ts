// Passa pelo proxy configurado em next.config.ts (/api -> http://localhost:8000)
export const API_URL = "/api";

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  preco: number;
  criadoEm: string;
  atualizadoEm: string;
}

// Corpo enviado ao cadastrar ou alterar um produto
export interface ProdutoInput {
  nome: string;
  categoria: string;
  descricao: string;
  preco: number;
}

export type StatusPedido =
  | 'RECEBIDO'
  | 'EM_PREPARO'
  | 'PRONTO_PARA_RETIRADA'
  | 'EM_ROTA_DE_ENTREGA'
  | 'ENTREGUE';

export interface ItemPedido {
  produtoId: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
  subtotal: number;
}

export interface Pedido {
  id: string;
  numero: number;
  cliente: string;
  telefone: string;
  endereco: string;
  observacao: string;
  itens: ItemPedido[];
  total: number;
  status: StatusPedido;
  historico: { status: StatusPedido; data: string }[];
  criadoEm: string;
  atualizadoEm: string;
}

// Corpo enviado ao criar ou alterar um pedido. O preço não vai: o servidor pega do cadastro de produtos.
export interface PedidoInput {
  cliente: string;
  telefone: string;
  endereco: string;
  observacao: string;
  itens: { produtoId: string; quantidade: number }[];
  status?: StatusPedido;
}

// Colunas do kanban, na ordem do fluxo.
// "acao" é o texto do botão que leva o pedido para a próxima etapa.
export const ETAPAS: { status: StatusPedido; titulo: string; acao: string; cor: string }[] = [
  { status: 'RECEBIDO', titulo: 'Recebido', acao: 'Iniciar preparo', cor: 'bg-sky-500' },
  { status: 'EM_PREPARO', titulo: 'Em preparo', acao: 'Marcar como pronto', cor: 'bg-amber-500' },
  { status: 'PRONTO_PARA_RETIRADA', titulo: 'Pronto para retirada', acao: 'Saiu para entrega', cor: 'bg-violet-500' },
  { status: 'EM_ROTA_DE_ENTREGA', titulo: 'Em rota de entrega', acao: 'Confirmar entrega', cor: 'bg-orange-500' },
  { status: 'ENTREGUE', titulo: 'Entregue', acao: '', cor: 'bg-emerald-500' },
];

export function etapaDoStatus(status: StatusPedido) {
  return ETAPAS.find((e) => e.status === status) ?? ETAPAS[0];
}

export function proximoStatus(status: StatusPedido): StatusPedido | null {
  const index = ETAPAS.findIndex((e) => e.status === status);
  return ETAPAS[index + 1]?.status ?? null;
}

export function statusAnterior(status: StatusPedido): StatusPedido | null {
  const index = ETAPAS.findIndex((e) => e.status === status);
  return index > 0 ? ETAPAS[index - 1].status : null;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarMoeda(valor: number) {
  return moeda.format(valor);
}

export function formatarHora(dataIso: string) {
  return new Date(dataIso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatarDataHora(dataIso: string) {
  return new Date(dataIso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function tempoDecorrido(dataIso: string) {
  const minutos = Math.floor((Date.now() - new Date(dataIso).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `há ${horas}h${String(minutos % 60).padStart(2, "0")}`;
}

export const ERRO_CONEXAO = 'Não foi possível conectar ao servidor. Ele está rodando na porta 8000?';

// O Nest devolve { message } nos erros (400, 404...). Mostramos essa mensagem na tela.
export async function lerErro(response: Response) {
  try {
    const data = await response.json();
    return Array.isArray(data.message) ? data.message.join(", ") : data.message;
  } catch {
    // Sem JSON e com erro 5xx: normalmente é o proxy do Next avisando que o Nest está fora do ar
    return response.status >= 500 ? ERRO_CONEXAO : `Erro ${response.status}`;
  }
}

export function mensagemDeErro(error: unknown) {
  return error instanceof Error ? error.message : ERRO_CONEXAO;
}
