"use client";

import { StatusPedidoBadge } from "@/components/modules/delivery/StatusPedidoBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pedidosApi } from "@/lib/api";
import { Pedido, StatusPedido, TODOS_STATUS, formatarDataHora, formatarMoeda, mensagemDeErro } from "@/lib/delivery";
import { useEventosPedidos } from "@/lib/eventos";
import { useUsuarioId } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import React from "react";

// Não existe mais "excluir pedido": apagar a linha apagaria a história dele.
// Para desistir de um pedido, usa-se a ação Cancelar (com justificativa) na tela do pedido.
export default function PedidoLista() {

  const usuarioId = useUsuarioId();
  const [pedidos, setPedidos] = React.useState<Pedido[]>([]);
  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [erro, setErro] = React.useState<string>('');

  const [busca, setBusca] = React.useState<string>('');
  const [filtroStatus, setFiltroStatus] = React.useState<StatusPedido | 'TODOS'>('TODOS');

  const fetchPedidos = React.useCallback(async () => {
    if (!usuarioId) return;
    try {
      setPedidos(await pedidosApi.listar());
      setErro('');
    } catch (error) {
      setErro(mensagemDeErro(error));
    } finally {
      setCarregando(false);
    }
  }, [usuarioId]);

  React.useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  // Lista sempre atualizada: recarrega quando o servidor avisa que algum pedido mudou (SSE)
  useEventosPedidos('/pedidos/eventos', () => { fetchPedidos(); }, fetchPedidos);

  // Busca pelo nome do cliente ou pelo número do pedido
  const termo = busca.trim().toLowerCase().replace('#', '');
  const pedidosFiltrados = pedidos
    .filter((p) =>
      (filtroStatus === 'TODOS' || p.status === filtroStatus) &&
      (p.cliente.toLowerCase().includes(termo) || String(p.numero) === termo)
    )
    .sort((a, b) => b.numero - a.numero);

  const quantidadePorStatus = (status: StatusPedido) => pedidos.filter((p) => p.status === status).length;

  return (
    <main className="container mx-auto space-y-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">{pedidos.length} pedido(s) cadastrado(s)</p>
        </div>
        <Button asChild>
          <Link href="/pedidos/novo"><Plus /> Novo pedido</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cliente ou nº do pedido"
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant={filtroStatus === 'TODOS' ? "default" : "outline"}
          onClick={() => setFiltroStatus('TODOS')}
        >
          Todos
        </Button>
        {TODOS_STATUS.map((etapa) => (
          <Button
            key={etapa.status}
            size="sm"
            variant={filtroStatus === etapa.status ? "default" : "outline"}
            onClick={() => setFiltroStatus(etapa.status)}
          >
            <span className={cn("size-2 rounded-full", etapa.cor)} />
            {etapa.titulo}
            <span className="tabular-nums opacity-60">{quantidadePorStatus(etapa.status)}</span>
          </Button>
        ))}
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 pl-4">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-16 pr-4 text-right">Abrir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidosFiltrados.map((pedido) => (
              <TableRow key={pedido.id}>
                <TableCell className="pl-4 font-bold tabular-nums">#{pedido.numero}</TableCell>
                <TableCell className="max-w-56">
                  <p className="truncate font-medium">{pedido.cliente}</p>
                  <p className="truncate text-xs text-muted-foreground">{pedido.endereco}</p>
                </TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {pedido.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(', ')}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatarMoeda(pedido.total)}
                  {pedido.valorPerda > 0 && (
                    <p className="text-xs font-normal text-destructive">perda {formatarMoeda(pedido.valorPerda)}</p>
                  )}
                </TableCell>
                <TableCell>
                  <StatusPedidoBadge status={pedido.status} />
                  {pedido.atrasado && <p className="mt-0.5 text-xs font-medium text-destructive">atrasado</p>}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{formatarDataHora(pedido.criadoEm)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`Abrir pedido ${pedido.numero}`}>
                      <Link href={`/pedidos/${pedido.id}`}><Pencil /></Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {!carregando && pedidosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {pedidos.length === 0 ? 'Nenhum pedido cadastrado ainda' : 'Nenhum pedido encontrado com esses filtros'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </main>
  );
}
