import { StatusPedido, etapaDoStatus } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export function StatusPedidoBadge({ status }: { status: StatusPedido }) {
  const etapa = etapaDoStatus(status);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <span className={cn("size-2 rounded-full", etapa.cor)} />
      {etapa.titulo}
    </span>
  );
}
