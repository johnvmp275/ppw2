// Estados possíveis de um pedido. Quem decide como sair de um estado para outro
// é a máquina de estados (domain/state-machine), nunca um formulário.
export const STATUS_PEDIDO = [
  'RECEBIDO',
  'EM_PREPARO',
  'PRONTO_PARA_RETIRADA',
  'EM_ROTA_DE_ENTREGA',
  'ENTREGUE',
  'CANCELADO',
] as const;

export type StatusPedido = (typeof STATUS_PEDIDO)[number];

// Estados finais: nenhuma ação sai deles
export const STATUS_FINAIS: readonly StatusPedido[] = ['ENTREGUE', 'CANCELADO'];

export function isStatusPedido(valor: unknown): valor is StatusPedido {
  return STATUS_PEDIDO.includes(valor as StatusPedido);
}
