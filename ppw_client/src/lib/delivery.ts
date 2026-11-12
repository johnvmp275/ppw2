// Passa pelo proxy configurado em next.config.ts (/api -> http://localhost:8000)
export const API_URL = "/api";

export type Papel = 'ATENDENTE' | 'COZINHEIRO' | 'ENTREGADOR' | 'GERENTE';

export interface Usuario {
  id: string;
  nome: string;
  papel: Papel;
}

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  preco: number;
  tempoPreparoMin: number;
  // null = feito na hora (não controla estoque)
  estoque: number | null;
  criadoEm: string;
  atualizadoEm: string;
}

// Corpo enviado ao cadastrar ou alterar um produto. O estoque só é informado no cadastro;
// depois disso muda por ajuste (+/-), nunca digitando o valor final.
export interface ProdutoInput {
  nome: string;
  categoria: string;
  descricao: string;
  preco: number;
  tempoPreparoMin: number;
  estoqueInicial?: number | null;
}

export type StatusPedido =
  | 'RECEBIDO'
  | 'EM_PREPARO'
  | 'PRONTO_PARA_RETIRADA'
  | 'EM_ROTA_DE_ENTREGA'
  | 'ENTREGUE'
  | 'CANCELADO';

export interface ItemPedido {
  produtoId: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
  subtotal: number;
  tempoPreparoMin: number;
  reservaEstoque: boolean;
}

// Uma ação da máquina de estados que o perfil atual pode executar agora.
// Quem decide a lista é o servidor; o front só desenha os botões.
export interface AcaoDisponivel {
  nome: string;
  rotulo: string;
  destino: StatusPedido;
  exigeJustificativa: boolean;
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
  versao: number;
  entregadorId: string | null;
  tempoPreparoMin: number;
  prazoPreparoEm: string | null;
  atrasado: boolean;
  valorPerda: number;
  acoesDisponiveis: AcaoDisponivel[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface RegistroHistorico {
  id: number;
  acao: string;
  estadoAnterior: StatusPedido | null;
  novoEstado: StatusPedido;
  autor: { id: string; nome: string; papel: Papel };
  justificativa: string | null;
  detalhes: Record<string, unknown> | null;
  criadoEm: string;
}

export interface LeadTimeEtapa {
  status: StatusPedido;
  pedidos: number;
  mediaMin: number;
  maximoMin: number;
}

// Corpo enviado ao criar um pedido. O preço não vai: o servidor pega do cadastro de produtos.
export interface PedidoInput {
  cliente: string;
  telefone: string;
  endereco: string;
  observacao: string;
  itens: { produtoId: string; quantidade: number }[];
}

// Na alteração vão também a versão que o usuário está vendo e, se o preparo já começou, a justificativa
export interface PedidoUpdateInput extends PedidoInput {
  versao: number;
  justificativa?: string;
}

// Colunas do kanban, na ordem do fluxo
export const ETAPAS: { status: StatusPedido; titulo: string; cor: string }[] = [
  { status: 'RECEBIDO', titulo: 'Recebido', cor: 'bg-sky-500' },
  { status: 'EM_PREPARO', titulo: 'Em preparo', cor: 'bg-amber-500' },
  { status: 'PRONTO_PARA_RETIRADA', titulo: 'Pronto para retirada', cor: 'bg-violet-500' },
  { status: 'EM_ROTA_DE_ENTREGA', titulo: 'Em rota de entrega', cor: 'bg-orange-500' },
  { status: 'ENTREGUE', titulo: 'Entregue', cor: 'bg-emerald-500' },
];

export const CANCELADO = { status: 'CANCELADO' as const, titulo: 'Cancelado', cor: 'bg-rose-500' };
export const TODOS_STATUS = [...ETAPAS, CANCELADO];

// Status em que ainda dá para adicionar/remover itens (mesma regra do servidor)
export const STATUS_EDITAVEIS: StatusPedido[] = ['RECEBIDO', 'EM_PREPARO'];

export function etapaDoStatus(status: StatusPedido) {
  return TODOS_STATUS.find((e) => e.status === status) ?? ETAPAS[0];
}

export const PAPEIS: Record<Papel, string> = {
  ATENDENTE: 'Atendente',
  COZINHEIRO: 'Cozinha',
  ENTREGADOR: 'Entregador',
  GERENTE: 'Gerente',
};

export const ROTULO_ACAO: Record<string, string> = {
  CRIAR: 'Pedido lançado',
  ALTERAR: 'Itens/dados alterados',
  INICIAR_PREPARO: 'Preparo iniciado',
  MARCAR_PRONTO: 'Marcado como pronto',
  DEVOLVER_AO_PREPARO: 'Devolvido ao preparo',
  DESPACHAR: 'Saiu para entrega',
  CONFIRMAR_ENTREGA: 'Entrega confirmada',
  CANCELAR: 'Cancelado',
};

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

export function tempoDecorrido(dataIso: string, agora = Date.now()) {
  const minutos = Math.floor((agora - new Date(dataIso).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `há ${horas}h${String(minutos % 60).padStart(2, "0")}`;
}

// "faltam 12 min" / "atrasado 3 min" em relação ao prazo do SLA
export function tempoParaPrazo(prazoIso: string, agora = Date.now()) {
  const minutos = Math.round((new Date(prazoIso).getTime() - agora) / 60000);
  return minutos >= 0 ? `faltam ${minutos} min` : `atrasado ${-minutos} min`;
}

export const ERRO_CONEXAO = 'Não foi possível conectar ao servidor. Ele está rodando na porta 8000?';

// Erro com o código HTTP, para a tela reagir diferente a 409 (recarregar) e 403/422 (só avisar)
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

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
