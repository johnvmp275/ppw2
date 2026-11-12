"use client";

import { PedidoCard } from "@/components/cards/PedidoCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { pedidosApi } from "@/lib/api";
import { ETAPAS, Pedido, StatusPedido, mensagemDeErro } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import React from "react";

// Intervalo para buscar pedidos novos que chegaram pelo PDV
const ATUALIZAR_A_CADA_MS = 5000;

export default function Cozinha() {

  const [pedidos, setPedidos] = React.useState<Pedido[]>([]);
  const [erro, setErro] = React.useState<string>('');
  const [colunaAtiva, setColunaAtiva] = React.useState<StatusPedido | null>(null);

  async function fetchPedidos(){
    try {
      setPedidos(await pedidosApi.listar());
      setErro('');
    } catch (error) {
      setErro(mensagemDeErro(error));
    }
  }

  React.useEffect(() => {
    fetchPedidos();
    const intervalo = setInterval(fetchPedidos, ATUALIZAR_A_CADA_MS);
    return () => clearInterval(intervalo);
  }, []);

  async function handleMoverPedido(id: string, status: StatusPedido){
    // Atualiza a tela na hora e depois confirma com o servidor
    setPedidos((atual) => atual.map((p) => p.id === id ? { ...p, status } : p));
    let falha = '';
    try {
      await pedidosApi.alterarStatus(id, status);
    } catch (error) {
      falha = mensagemDeErro(error);
    }
    // Recarrega primeiro e só depois mostra o erro, senão o fetchPedidos o apagaria
    await fetchPedidos();
    if (falha) setErro(falha);
  }

  async function handleCancelarPedido(id: string){
    const pedido = pedidos.find((p) => p.id === id);
    if (!window.confirm(`Cancelar o pedido #${pedido?.numero}?`)) return;

    let falha = '';
    try {
      await pedidosApi.excluir(id);
    } catch (error) {
      falha = mensagemDeErro(error);
    }
    await fetchPedidos();
    if (falha) setErro(falha);
  }

  function handleDrop(e: React.DragEvent, status: StatusPedido){
    e.preventDefault();
    setColunaAtiva(null);
    const id = e.dataTransfer.getData("text/plain");
    const pedido = pedidos.find((p) => p.id === id);
    if (pedido && pedido.status !== status) {
      handleMoverPedido(id, status);
    }
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

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Painel da cozinha</h1>
        <p className="text-sm text-muted-foreground">
          Arraste os cartões entre as colunas ou use os botões. Atualiza sozinho a cada 5 segundos.
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

              {lista.length === 0 ? (
                <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                  Nenhum pedido
                </p>
              ) : (
                lista.map((pedido) => (
                  <PedidoCard
                    key={pedido.id}
                    pedido={pedido}
                    onMover={handleMoverPedido}
                    onCancelar={handleCancelarPedido}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
