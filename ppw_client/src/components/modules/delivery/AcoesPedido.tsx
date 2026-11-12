import { Button } from "@/components/ui/button";
import { AcaoDisponivel, Pedido } from "@/lib/delivery";
import { cn } from "@/lib/utils";

interface AcoesPedidoProps {
  pedido: Pedido;
  onExecutar: (pedido: Pedido, acao: AcaoDisponivel) => void;
  desabilitado?: boolean;
  className?: string;
}

// Desenha um botão por ação que o servidor liberou para o perfil atual.
// Cancelar fica por último e em vermelho; as demais avançam o fluxo.
export function AcoesPedido({ pedido, onExecutar, desabilitado, className }: AcoesPedidoProps) {
  const acoes = [...pedido.acoesDisponiveis].sort(
    (a, b) => Number(a.destino === 'CANCELADO') - Number(b.destino === 'CANCELADO')
  );

  if (acoes.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {acoes.map((acao) => {
        const cancelar = acao.destino === 'CANCELADO';
        const voltar = acao.nome === 'DEVOLVER_AO_PREPARO';
        return (
          <Button
            key={acao.nome}
            size="sm"
            variant={cancelar ? 'ghost' : voltar ? 'outline' : 'default'}
            className={cn(cancelar ? "text-destructive hover:text-destructive" : "flex-1")}
            disabled={desabilitado}
            title={acao.exigeJustificativa ? 'Exige justificativa' : undefined}
            onClick={() => onExecutar(pedido, acao)}
          >
            {acao.rotulo}
            {acao.exigeJustificativa && <span aria-hidden>*</span>}
          </Button>
        );
      })}
    </div>
  );
}
