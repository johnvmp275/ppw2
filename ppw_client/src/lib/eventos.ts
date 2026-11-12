"use client";

import { API_URL, StatusPedido } from "@/lib/delivery";
import React from "react";

export interface EventoPedido {
  tipo: 'PEDIDO_CRIADO' | 'PEDIDO_ALTERADO' | 'PEDIDO_TRANSICIONADO';
  pedidoId: string;
  numero: number;
  status: StatusPedido;
  versao: number;
  acao: string;
}

export type EstadoConexao = 'conectando' | 'ao-vivo' | 'reconectando';

// Server-Sent Events: uma conexão HTTP fica aberta e o servidor empurra um aviso
// a cada mudança. Substitui o setInterval de 5 s (polling) da versão anterior.
// O EventSource reconecta sozinho; ao reconectar, chamamos onReconectar para
// buscar o que pode ter mudado enquanto a conexão estava caída.
export function useEventosPedidos(
  caminho: string,
  onEvento: (evento: EventoPedido) => void,
  onReconectar?: () => void,
): EstadoConexao {
  const [estado, setEstado] = React.useState<EstadoConexao>('conectando');
  const handlers = React.useRef({ onEvento, onReconectar });
  React.useEffect(() => {
    handlers.current = { onEvento, onReconectar };
  });

  React.useEffect(() => {
    const fonte = new EventSource(`${API_URL}${caminho}`);
    let caiu = false;

    fonte.onopen = () => {
      setEstado('ao-vivo');
      if (caiu) handlers.current.onReconectar?.();
      caiu = false;
    };
    fonte.onerror = () => {
      caiu = true;
      setEstado('reconectando');
    };
    // Eventos sem "type" chegam em onmessage; o heartbeat do servidor tem type "ping" e é ignorado
    fonte.onmessage = (mensagem) => {
      try {
        handlers.current.onEvento(JSON.parse(mensagem.data));
      } catch {
        // mensagem malformada: ignora
      }
    };

    return () => fonte.close();
  }, [caminho]);

  return estado;
}

// Atualiza o "agora" periodicamente para os cronômetros de SLA
export function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}
