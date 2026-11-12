import { AcoesPedido } from "@/components/modules/delivery/AcoesPedido";
import { AcaoDisponivel, Pedido, formatarHora, formatarMoeda, tempoDecorrido, tempoParaPrazo } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Clock, MapPin, Pencil, Phone } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";

interface PedidoCardProps {
  pedido: Pedido,
  agora: number,
  onExecutar: (pedido: Pedido, acao: AcaoDisponivel) => void,
  desabilitado?: boolean,
}

export function PedidoCard({ pedido, agora, onExecutar, desabilitado }: PedidoCardProps){
  // Só dá para arrastar se o perfil tiver alguma ação que não seja cancelar
  const arrastavel = pedido.acoesDisponiveis.some((a) => a.destino !== 'CANCELADO');
  const atrasado = pedido.status === 'EM_PREPARO' && !!pedido.prazoPreparoEm && new Date(pedido.prazoPreparoEm).getTime() < agora;

  return (
    <Card
      size="sm"
      draggable={arrastavel}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", pedido.id)}
      className={cn(
        arrastavel && "cursor-grab active:cursor-grabbing",
        atrasado && "ring-2 ring-destructive"
      )}
    >
      <CardHeader>
        <CardTitle className="text-base font-bold">#{pedido.numero} · {pedido.cliente}</CardTitle>
        <CardDescription>
          {formatarHora(pedido.criadoEm)} · {tempoDecorrido(pedido.criadoEm, agora)}
        </CardDescription>
        <CardAction>
          <Button
            asChild
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground"
            aria-label={`Abrir pedido ${pedido.numero}`}
          >
            <Link href={`/pedidos/${pedido.id}`} draggable={false}>
              <Pencil />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* SLA da cozinha: começa a contar quando o preparo inicia */}
        {pedido.status === 'EM_PREPARO' && pedido.prazoPreparoEm && (
          <p
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
              atrasado
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            )}
          >
            <Clock className="size-3" />
            {tempoParaPrazo(pedido.prazoPreparoEm, agora)} · até {formatarHora(pedido.prazoPreparoEm)}
          </p>
        )}

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

      {pedido.acoesDisponiveis.length > 0 && (
        <CardFooter>
          <AcoesPedido pedido={pedido} onExecutar={onExecutar} desabilitado={desabilitado} className="w-full" />
        </CardFooter>
      )}
    </Card>
  )
}
