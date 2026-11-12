import { ETAPAS, Pedido, StatusPedido, formatarHora, formatarMoeda, proximoStatus, statusAnterior, tempoDecorrido } from "@/lib/delivery";
import { ChevronLeft, MapPin, Pencil, Phone, X } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";

interface PedidoCardProps {
  pedido: Pedido,
  onMover: (id: string, status: StatusPedido) => void,
  onCancelar: (id: string) => void,
}

export function PedidoCard({ pedido, onMover, onCancelar }: PedidoCardProps){
  const proximo = proximoStatus(pedido.status);
  const anterior = statusAnterior(pedido.status);
  const acao = ETAPAS.find((e) => e.status === pedido.status)?.acao;

  return (
    <Card
      size="sm"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", pedido.id)}
      className="cursor-grab active:cursor-grabbing"
    >
      <CardHeader>
        <CardTitle className="text-base font-bold">#{pedido.numero} · {pedido.cliente}</CardTitle>
        <CardDescription>
          {formatarHora(pedido.criadoEm)} · {tempoDecorrido(pedido.criadoEm)}
        </CardDescription>
        <CardAction className="flex gap-0.5">
          <Button
            asChild
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground"
            aria-label={`Editar pedido ${pedido.numero}`}
          >
            <Link href={`/pedidos/${pedido.id}`} draggable={false}>
              <Pencil />
            </Link>
          </Button>
          {pedido.status !== 'ENTREGUE' && (
            <Button
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Cancelar pedido ${pedido.numero}`}
              onClick={() => onCancelar(pedido.id)}
            >
              <X />
            </Button>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-2">
        <ul className="space-y-0.5">
          {pedido.itens.map((item) => (
            <li key={item.produtoId} className="flex gap-2">
              <span className="font-semibold tabular-nums">{item.quantidade}×</span>
              <span>{item.nome}</span>
            </li>
          ))}
        </ul>

        {pedido.observacao && (
          <p className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Obs.: {pedido.observacao}
          </p>
        )}

        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p className="flex items-start gap-1"><MapPin className="mt-0.5 size-3 shrink-0" />{pedido.endereco}</p>
          {pedido.telefone && (
            <p className="flex items-center gap-1"><Phone className="size-3 shrink-0" />{pedido.telefone}</p>
          )}
        </div>

        <p className="font-semibold">{formatarMoeda(pedido.total)}</p>
      </CardContent>

      {(anterior || proximo) && (
        <CardFooter className="gap-2">
          {anterior && (
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Voltar para a etapa anterior"
              onClick={() => onMover(pedido.id, anterior)}
            >
              <ChevronLeft />
            </Button>
          )}
          {proximo && (
            <Button size="sm" className="flex-1" onClick={() => onMover(pedido.id, proximo)}>
              {acao}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
