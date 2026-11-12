// Fluxo do pedido na cozinha, na ordem em que acontece
export const STATUS_PEDIDO = [
  'RECEBIDO',
  'EM_PREPARO',
  'PRONTO_PARA_RETIRADA',
  'EM_ROTA_DE_ENTREGA',
  'ENTREGUE',
] as const;

export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export function isStatusPedido(valor: unknown): valor is StatusPedido {
  return STATUS_PEDIDO.includes(valor as StatusPedido);
}
