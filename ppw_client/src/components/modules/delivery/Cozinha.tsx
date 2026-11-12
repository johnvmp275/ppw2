"use client";

import { PedidoCard } from "@/components/cards/PedidoCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { pedidosApi } from "@/lib/api";
import { ETAPAS, LeadTimeEtapa, Pedido, StatusPedido, mensagemDeErro } from "@/lib/delivery";
import { EventoPedido, useAgora, useEventosPedidos } from "@/lib/eventos";
import { useUsuarioId } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import React from "react";
import { toast } from "sonner";
import { useExecutorAcoes } from "./useExecutorAcoes";

export default function Cozinha() {

  const usuarioId = useUsuarioId();
  const agora = useAgora();
  const [pedidos, setPedidos] = React.useState<Pedido[]>([]);
  const [leadTime, setLeadTime] = React.useState<LeadTimeEtapa[]>([]);
  const [erro, setErro] = React.useState<string>('');
  const [colunaAtiva, setColunaAtiva] = React.useState<StatusPedido | null>(null);

  const fetchPedidos = React.useCallback(async () => {
    if (!usuarioId) return;
    try {
      const [lista, metricas] = await Promise.all([pedidosApi.listar(), pedidosApi.leadTime()]);
      setPedidos(lista);
      setLeadTime(metricas);
      setErro('');
    } catch (error) {
      setErro(mensagemDeErro(error));
    }
  }, [usuarioId]);

  // Carrega de novo quando o perfil muda (as ações disponíveis são diferentes)
  React.useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  function substituir(atualizado: Pedido) {
    setPedidos((atual) => {
      const existe = atual.some((p) => p.id === atualizado.id);
      return existe ? atual.map((p) => (p.id === atualizado.id ? atualizado : p)) : [...atual, atualizado];
    });
  }

  // Tempo real: o servidor avisa qual pedido mudou e buscamos só ele (com as ações do perfil atual)
  async function handleEvento(evento: EventoPedido) {
    const atual = pedidos.find((p) => p.id === evento.pedidoId);
    if (atual && atual.versao >= evento.versao) return; // já temos essa versão (fomos nós que mudamos)
    try {
      substituir(await pedidosApi.buscar(evento.pedidoId));
      if (evento.tipo === 'PEDIDO_CRIADO') toast.info(`Novo pedido #${evento.numero} na cozinha`);
    } catch {
      // se falhar, a próxima reconexão recarrega tudo
    }
  }

  const conexao = useEventosPedidos('/pedidos/eventos', handleEvento, fetchPedidos);

  const { executar, dialogo, enviando } = useExecutorAcoes({
    onSucesso: substituir,
    // 409: alguém mexeu antes; recarrega para mostrar o estado real
    onFalha: (_pedido, status) => { if (status === 409) fetchPedidos(); },
  });

  // Arrastar só funciona se existir uma ação que leve para aquela coluna
  function handleDrop(e: React.DragEvent, status: StatusPedido){
    e.preventDefault();
    setColunaAtiva(null);
    const pedido = pedidos.find((p) => p.id === e.dataTransfer.getData("text/plain"));
    if (!pedido || pedido.status === status) return;

    const acao = pedido.acoesDisponiveis.find((a) => a.destino === status);
    if (!acao) {
      toast.error(`O pedido #${pedido.numero} não pode ir de "${pedido.status}" para "${status}" com o seu perfil`);
      return;
    }
    executar(pedido, acao);
  }

  function pedidosDaColuna(status: StatusPedido){
    const lista = pedidos.filter((p) => p.status === status);
    // Na cozinha, o pedido mais antigo vem primeiro. Nos entregues, o mais recente.
    return lista.sort((a, b) =>
      status === 'ENTREGUE'
        ? b.atualizadoEm.localeCompare(a.atualizadoEm)
        : a.criadoEm.localeCompare(b.criadoEm)
    );
  }

  const cancelados = pedidos.filter((p) => p.status === 'CANCELADO').length;
  const atrasados = pedidos.filter((p) => p.status === 'EM_PREPARO' && p.prazoPreparoEm && new Date(p.prazoPreparoEm).getTime() < agora).length;
  const mediaDaEtapa = (status: StatusPedido) => leadTime.find((l) => l.status === status)?.mediaMin;

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Painel da cozinha</h1>
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {atrasados > 0 && <span className="font-medium text-destructive">{atrasados} atrasado(s)</span>}
          {cancelados > 0 && <span>{cancelados} cancelado(s)</span>}
          <span className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", conexao === 'ao-vivo' ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
            {conexao === 'ao-vivo' ? 'Ao vivo' : conexao === 'conectando' ? 'Conectando...' : 'Reconectando...'}
          </span>
        </p>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <div className="grid flex-1 auto-cols-[minmax(260px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2">
        {ETAPAS.map((etapa) => {
          const lista = pedidosDaColuna(etapa.status);
          const media = mediaDaEtapa(etapa.status);
          return (
            <section
              key={etapa.status}
              onDragOver={(e) => { e.preventDefault(); setColunaAtiva(etapa.status); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setColunaAtiva(null);
              }}
              onDrop={(e) => handleDrop(e, etapa.status)}
              className={cn(
                "flex min-h-64 flex-col gap-3 rounded-xl bg-muted p-3 transition-colors",
                colunaAtiva === etapa.status && "bg-primary/10 ring-2 ring-primary/40"
              )}
            >
              <header className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", etapa.cor)} />
                <h2 className="font-semibold">{etapa.titulo}</h2>
                <span className="ml-auto rounded-full bg-background px-2 text-xs font-medium tabular-nums">
                  {lista.length}
                </span>
              </header>
              {/* Lead time: média de minutos que os pedidos ficam nesta coluna (calculado da trilha de auditoria) */}
              {media !== undefined && (
                <p className="-mt-2 text-xs text-muted-foreground">média de {media} min nesta etapa</p>
              )}

              {lista.length === 0 ? (
                <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                  Nenhum pedido
                </p>
              ) : (
                lista.map((pedido) => (
                  <PedidoCard
                    key={pedido.id}
                    pedido={pedido}
                    agora={agora}
                    onExecutar={executar}
                    desabilitado={enviando}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
      {dialogo}
    </main>
  );
}
