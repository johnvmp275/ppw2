"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { pedidosApi } from "@/lib/api";
import { AcaoDisponivel, ApiError, Pedido, ROTULO_ACAO, mensagemDeErro } from "@/lib/delivery";
import React from "react";
import { toast } from "sonner";

const JUSTIFICATIVA_MINIMA = 10;

interface Opcoes {
  // Pedido como o servidor devolveu depois da ação (status e versão novos)
  onSucesso: (pedido: Pedido) => void;
  // Falhou: 409 = alguém mexeu antes (recarregar); 403/422 = regra de negócio
  onFalha?: (pedido: Pedido, status: number) => void;
}

// Executa ações da máquina de estados. Quando a ação exige justificativa, abre um diálogo antes.
// O front não decide nada: mostra só as ações que o servidor listou e repassa o erro dele.
export function useExecutorAcoes({ onSucesso, onFalha }: Opcoes) {
  const [pendente, setPendente] = React.useState<{ pedido: Pedido; acao: AcaoDisponivel } | null>(null);
  const [justificativa, setJustificativa] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);

  async function enviar(pedido: Pedido, acao: AcaoDisponivel, texto?: string) {
    setEnviando(true);
    try {
      const atualizado = await pedidosApi.executarAcao(pedido, acao.nome, texto);
      toast.success(`Pedido #${pedido.numero}: ${(ROTULO_ACAO[acao.nome] ?? acao.rotulo).toLowerCase()}`);
      setPendente(null);
      onSucesso(atualizado);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      const mensagem = mensagemDeErro(error);
      // O SLA pode ter estourado depois que a tela carregou: o servidor passa a exigir justificativa
      if (status === 422 && !texto && mensagem.includes('justificativa')) {
        setJustificativa('');
        setPendente({ pedido, acao: { ...acao, exigeJustificativa: true } });
        toast.warning(mensagem);
        return;
      }
      toast.error(mensagem);
      if (status === 409) setPendente(null);
      onFalha?.(pedido, status);
    } finally {
      setEnviando(false);
    }
  }

  function executar(pedido: Pedido, acao: AcaoDisponivel) {
    if (acao.exigeJustificativa) {
      setJustificativa('');
      setPendente({ pedido, acao });
    } else {
      enviar(pedido, acao);
    }
  }

  const curta = justificativa.trim().length < JUSTIFICATIVA_MINIMA;

  const dialogo = (
    <Dialog open={pendente !== null} onOpenChange={(aberto) => !aberto && !enviando && setPendente(null)}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (pendente && !curta) enviar(pendente.pedido, pendente.acao, justificativa.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {pendente?.acao.rotulo} · pedido #{pendente?.pedido.numero}
            </DialogTitle>
            <DialogDescription>
              Esta ação exige uma justificativa. Ela fica gravada no histórico do pedido com o seu nome.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="justificativa">Justificativa</Label>
            <Textarea
              id="justificativa"
              autoFocus
              placeholder="Ex.: cliente ligou desistindo do pedido"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {curta ? `Mínimo de ${JUSTIFICATIVA_MINIMA} caracteres.` : 'Pronto para enviar.'}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={enviando} onClick={() => setPendente(null)}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant={pendente?.acao.destino === 'CANCELADO' ? 'destructive' : 'default'}
              disabled={curta || enviando}
            >
              {enviando ? 'Enviando...' : pendente?.acao.rotulo}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { executar, dialogo, enviando };
}
