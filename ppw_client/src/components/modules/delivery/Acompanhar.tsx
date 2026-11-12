"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Acompanhamento, acompanhamentoApi } from "@/lib/api";
import { CANCELADO, ETAPAS, formatarHora, formatarMoeda, mensagemDeErro } from "@/lib/delivery";
import { useEventosPedidos } from "@/lib/eventos";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import React from "react";

// Acompanhamento em tempo real para o cliente: a conexão SSE recebe só os eventos
// deste pedido. Nada de recarregar a página nem de polling.
export default function Acompanhar({ id }: { id: string }) {
  const [pedido, setPedido] = React.useState<Acompanhamento | null>(null);
  const [erro, setErro] = React.useState('');

  const carregar = React.useCallback(async () => {
    try {
      setPedido(await acompanhamentoApi.buscar(id));
      setErro('');
    } catch (error) {
      setErro(mensagemDeErro(error));
    }
  }, [id]);

  React.useEffect(() => {
    carregar();
  }, [carregar]);

  const conexao = useEventosPedidos(`/acompanhamento/${id}/eventos`, () => { carregar(); }, carregar);

  if (erro) {
    return (
      <main className="container mx-auto max-w-md px-4 py-10">
        <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>
      </main>
    );
  }
  if (!pedido) {
    return <main className="container mx-auto max-w-md px-4 py-10 text-sm text-muted-foreground">Carregando...</main>;
  }

  const cancelado = pedido.status === 'CANCELADO';
  const indiceAtual = ETAPAS.findIndex((e) => e.status === pedido.status);
  const quando = (status: string) => [...pedido.linhaDoTempo].reverse().find((l) => l.status === status)?.em;

  return (
    <main className="container mx-auto max-w-md space-y-4 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Olá, {pedido.cliente}!</p>
        <h1 className="text-2xl font-bold">Pedido #{pedido.numero}</h1>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-2 rounded-full", conexao === 'ao-vivo' ? "bg-emerald-500" : "bg-amber-500")} />
          {conexao === 'ao-vivo' ? 'Atualiza sozinho' : 'Reconectando...'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{cancelado ? 'Pedido cancelado' : ETAPAS[indiceAtual]?.titulo}</CardTitle>
          {pedido.prazoPreparoEm && pedido.status === 'EM_PREPARO' && (
            <CardDescription>
              {pedido.atrasado ? 'Está demorando um pouco mais que o previsto' : `Previsão de ficar pronto: ${formatarHora(pedido.prazoPreparoEm)}`}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {(cancelado ? [...ETAPAS.filter((e) => quando(e.status)), CANCELADO] : ETAPAS).map((etapa, index) => {
              const feito = cancelado ? true : index <= indiceAtual;
              const hora = quando(etapa.status);
              return (
                <li key={etapa.status} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-white",
                      feito ? etapa.cor : "bg-muted"
                    )}
                  >
                    {feito && <Check className="size-3.5" />}
                  </span>
                  <span className={cn("flex-1", !feito && "text-muted-foreground")}>{etapa.titulo}</span>
                  {hora && <span className="text-xs text-muted-foreground tabular-nums">{formatarHora(hora)}</span>}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="space-y-1 text-sm">
          {pedido.itens.map((item) => (
            <p key={item.nome}>{item.quantidade}× {item.nome}</p>
          ))}
          <p className="pt-2 font-semibold">{formatarMoeda(pedido.total)}</p>
        </CardContent>
      </Card>
    </main>
  );
}
