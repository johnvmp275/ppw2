"use client";

import { AcoesPedido } from "@/components/modules/delivery/AcoesPedido";
import { StatusPedidoBadge } from "@/components/modules/delivery/StatusPedidoBadge";
import { useExecutorAcoes } from "@/components/modules/delivery/useExecutorAcoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { pedidosApi, produtosApi } from "@/lib/api";
import {
  ApiError,
  PAPEIS,
  Pedido,
  PedidoInput,
  Produto,
  ROTULO_ACAO,
  RegistroHistorico,
  STATUS_EDITAVEIS,
  etapaDoStatus,
  formatarDataHora,
  formatarHora,
  formatarMoeda,
  mensagemDeErro,
} from "@/lib/delivery";
import { useEventosPedidos } from "@/lib/eventos";
import { useUsuarioId } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import React from "react";
import { toast } from "sonner";

interface PedidoFormProps {
  // Sem id o formulário cria um pedido; com id ele carrega o pedido e altera
  id?: string;
}

// Uma linha da lista de itens. A quantidade fica como texto enquanto o usuário digita.
interface LinhaItem {
  chave: number;
  produtoId: string;
  quantidade: string;
}

// Chave única para o React identificar cada linha, mesmo com o produto ainda vazio
let ultimaChave = 0;
function novaLinha(produtoId = '', quantidade = '1'): LinhaItem {
  ultimaChave += 1;
  return { chave: ultimaChave, produtoId, quantidade };
}

export default function PedidoForm({ id }: PedidoFormProps) {

  const usuarioId = useUsuarioId();
  const editando = Boolean(id);

  const [produtos, setProdutos] = React.useState<Produto[]>([]);
  const [pedido, setPedido] = React.useState<Pedido | null>(null);
  const [historico, setHistorico] = React.useState<RegistroHistorico[]>([]);

  const [cliente, setCliente] = React.useState<string>('');
  const [telefone, setTelefone] = React.useState<string>('');
  const [endereco, setEndereco] = React.useState<string>('');
  const [observacao, setObservacao] = React.useState<string>('');
  const [linhas, setLinhas] = React.useState<LinhaItem[]>([novaLinha()]);
  const [justificativa, setJustificativa] = React.useState<string>('');

  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [naoEncontrado, setNaoEncontrado] = React.useState<boolean>(false);
  const [salvando, setSalvando] = React.useState<boolean>(false);
  const [erro, setErro] = React.useState<string>('');
  // O usuário mexeu no formulário e ainda não salvou
  const [sujo, setSujo] = React.useState<boolean>(false);
  // Chegou aviso (SSE) de que outra pessoa alterou o pedido enquanto este formulário estava sujo
  const [desatualizado, setDesatualizado] = React.useState<boolean>(false);

  function preencher(atual: Pedido) {
    setPedido(atual);
    setCliente(atual.cliente);
    setTelefone(atual.telefone);
    setEndereco(atual.endereco);
    setObservacao(atual.observacao);
    setLinhas(atual.itens.map((item) => novaLinha(item.produtoId, String(item.quantidade))));
    setJustificativa('');
    setSujo(false);
    setDesatualizado(false);
  }

  const recarregar = React.useCallback(async () => {
    if (!id) return;
    const [atual, registros] = await Promise.all([pedidosApi.buscar(id), pedidosApi.historico(id)]);
    preencher(atual);
    setHistorico(registros);
  }, [id]);

  React.useEffect(() => {
    if (!usuarioId) return;
    async function carregar(){
      try {
        setProdutos(await produtosApi.listar());
        await recarregar();
        setErro('');
      } catch (error) {
        setErro(mensagemDeErro(error));
        if (id) setNaoEncontrado(true);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [id, usuarioId, recarregar]);

  // Tempo real: se outra pessoa mexer neste pedido, recarrega (ou avisa, se houver edição não salva)
  useEventosPedidos(id ? `/acompanhamento/${id}/eventos` : '/pedidos/eventos', (evento) => {
    if (!id || !pedido || evento.versao <= pedido.versao) return;
    if (sujo) {
      setDesatualizado(true);
    } else {
      recarregar().catch(() => undefined);
      toast.info(`O pedido #${pedido.numero} foi atualizado por outra pessoa`);
    }
  });

  const { executar, dialogo, enviando } = useExecutorAcoes({
    onSucesso: (atualizado) => {
      setPedido(atualizado);
      pedidosApi.historico(atualizado.id).then(setHistorico).catch(() => undefined);
    },
    onFalha: (_p, status) => { if (status === 409) recarregar().catch(() => undefined); },
  });

  // Mesma regra do servidor: item que já estava no pedido mantém o preço da venda,
  // item novo usa o preço atual do cardápio
  function precoUnitario(produtoId: string) {
    const itemOriginal = pedido?.itens.find((item) => item.produtoId === produtoId);
    if (itemOriginal) return itemOriginal.precoUnitario;
    return produtos.find((p) => p.id === produtoId)?.preco ?? 0;
  }

  function alterarLinha(chave: number, campos: Partial<LinhaItem>){
    setLinhas((atual) => atual.map((linha) => linha.chave === chave ? { ...linha, ...campos } : linha));
    setSujo(true);
  }

  function removerLinha(chave: number){
    setLinhas((atual) => atual.filter((linha) => linha.chave !== chave));
    setSujo(true);
  }

  // Envolve os setters dos campos de texto para marcar o formulário como alterado
  const campo = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    setSujo(true);
  };

  async function handleSalvar(e: React.SubmitEvent){
    e.preventDefault();
    setSalvando(true);
    setErro('');

    const dados: PedidoInput = {
      cliente,
      telefone,
      endereco,
      observacao,
      itens: linhas.map((linha) => ({ produtoId: linha.produtoId, quantidade: Number(linha.quantidade) })),
    };

    try {
      if (pedido) {
        // A versão diz ao servidor em cima de qual estado do pedido o usuário decidiu.
        // Se outra pessoa gravou antes, ele responde 409 em vez de sobrescrever.
        const atualizado = await pedidosApi.atualizar(pedido.id, { ...dados, versao: pedido.versao, justificativa });
        preencher(atualizado);
        setHistorico(await pedidosApi.historico(atualizado.id));
        toast.success(`Pedido #${atualizado.numero} alterado`);
      } else {
        const criado = await pedidosApi.criar(dados);
        toast.success(`Pedido #${criado.numero} enviado para a cozinha`, {
          action: { label: 'Abrir', onClick: () => window.location.assign(`/pedidos/${criado.id}`) },
        });
        setCliente(''); setTelefone(''); setEndereco(''); setObservacao('');
        setLinhas([novaLinha()]);
        setSujo(false);
      }
    } catch (error) {
      setErro(mensagemDeErro(error));
      if (error instanceof ApiError && error.status === 409 && pedido) {
        await recarregar().catch(() => undefined);
        setErro(`${mensagemDeErro(error)}. O formulário foi recarregado com os dados atuais.`);
      }
    } finally {
      setSalvando(false);
    }
  }

  // Produtos agrupados por categoria para o <select> de cada item
  const categorias = [...new Set(produtos.map((p) => p.categoria))].sort();
  // Itens do pedido cujo produto já saiu do cardápio continuam selecionáveis
  const foraDoCardapio = (pedido?.itens ?? []).filter((item) => !produtos.some((p) => p.id === item.produtoId));

  const total = linhas.reduce((soma, linha) => soma + precoUnitario(linha.produtoId) * (Number(linha.quantidade) || 0), 0);
  const podeEditar = !pedido || STATUS_EDITAVEIS.includes(pedido.status);
  const exigeJustificativa = pedido?.status === 'EM_PREPARO';

  if (carregando) {
    return <main className="container mx-auto px-4 py-8 text-sm text-muted-foreground">Carregando...</main>;
  }

  if (naoEncontrado) {
    return (
      <main className="container mx-auto max-w-2xl space-y-4 px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/pedidos"><ArrowLeft /> Voltar para os pedidos</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-5xl space-y-4 px-4 py-8">
      <Link
        href="/pedidos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Pedidos
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{pedido ? `Pedido #${pedido.numero}` : 'Novo pedido'}</h1>
        {pedido && <StatusPedidoBadge status={pedido.status} />}
        {pedido && <span className="text-xs text-muted-foreground">versão {pedido.versao}</span>}
      </div>

      {desatualizado && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            Outra pessoa alterou este pedido enquanto você editava. Se salvar agora, o servidor vai recusar.
            <Button size="sm" variant="outline" onClick={() => recarregar()}>
              <RefreshCw /> Recarregar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSalvar} className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <fieldset disabled={!podeEditar} className="min-w-0 space-y-6">

          { /* Cliente e entrega */ }
          <Card>
            <CardHeader>
              <CardTitle>Cliente e entrega</CardTitle>
              {!podeEditar && (
                <CardDescription>
                  O pedido está {etapaDoStatus(pedido!.status).titulo.toLowerCase()} e não pode mais ser alterado.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cliente">Cliente</Label>
                <Input id="cliente" required value={cliente} onChange={campo(setCliente)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" type="tel" placeholder="Opcional" value={telefone} onChange={campo(setTelefone)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="endereco">Endereço de entrega</Label>
                <Input id="endereco" required value={endereco} onChange={campo(setEndereco)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="observacao">Observação</Label>
                <Textarea
                  id="observacao"
                  placeholder="Ex.: sem cebola, troco para R$ 50"
                  value={observacao}
                  onChange={campo(setObservacao)}
                />
              </div>
            </CardContent>
          </Card>

          { /* Itens */ }
          <Card>
            <CardHeader>
              <CardTitle>Itens</CardTitle>
              <CardDescription>
                {exigeJustificativa
                  ? 'O preparo já começou: pratos removidos viram perda e bebidas/sobremesas voltam ao estoque.'
                  : 'O preço vem do cadastro de produtos.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {produtos.length === 0 && foraDoCardapio.length === 0 && (
                <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                  Nenhum produto cadastrado.{" "}
                  <Link href="/produtos/novo" className="font-medium text-foreground underline">Cadastre produtos</Link>{" "}
                  para montar pedidos.
                </p>
              )}

              {linhas.map((linha, index) => {
                const preco = precoUnitario(linha.produtoId);
                // Um produto só pode aparecer em uma linha: para mais unidades, aumenta a quantidade
                const usadoEmOutraLinha = (produtoId: string) =>
                  linhas.some((l) => l.chave !== linha.chave && l.produtoId === produtoId);

                return (
                  <div key={linha.chave} className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
                    <div className="min-w-0 flex-1 basis-full space-y-1.5 sm:basis-auto">
                      <Label htmlFor={`produto-${linha.chave}`} className={index > 0 ? "sr-only" : undefined}>
                        Produto
                      </Label>
                      <NativeSelect
                        id={`produto-${linha.chave}`}
                        required
                        value={linha.produtoId}
                        onChange={(e) => alterarLinha(linha.chave, { produtoId: e.target.value })}
                      >
                        <option value="" disabled>Selecione um produto</option>
                        {categorias.map((c) => (
                          <optgroup key={c} label={c}>
                            {produtos.filter((p) => p.categoria === c).map((p) => (
                              <option
                                key={p.id}
                                value={p.id}
                                disabled={usadoEmOutraLinha(p.id) || p.estoque === 0}
                              >
                                {p.nome} · {formatarMoeda(p.preco)}
                                {p.estoque !== null ? ` · ${p.estoque} em estoque` : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        {foraDoCardapio.length > 0 && (
                          <optgroup label="Fora do cardápio">
                            {foraDoCardapio.map((item) => (
                              <option key={item.produtoId} value={item.produtoId} disabled={usadoEmOutraLinha(item.produtoId)}>
                                {item.nome} · {formatarMoeda(item.precoUnitario)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </NativeSelect>
                    </div>

                    <div className="w-20 space-y-1.5">
                      <Label htmlFor={`quantidade-${linha.chave}`} className={index > 0 ? "sr-only" : undefined}>
                        Qtd.
                      </Label>
                      <Input
                        id={`quantidade-${linha.chave}`}
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={linha.quantidade}
                        onChange={(e) => alterarLinha(linha.chave, { quantidade: e.target.value })}
                      />
                    </div>

                    <p className="flex h-8 w-24 items-center justify-end text-sm font-medium tabular-nums">
                      {formatarMoeda(preco * (Number(linha.quantidade) || 0))}
                    </p>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      aria-label="Remover item"
                      disabled={linhas.length === 1}
                      onClick={() => removerLinha(linha.chave)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={linhas.length >= produtos.length + foraDoCardapio.length}
                onClick={() => { setLinhas((atual) => [...atual, novaLinha()]); setSujo(true); }}
              >
                <Plus /> Adicionar item
              </Button>
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="text-xl font-bold tabular-nums">{formatarMoeda(total)}</span>
            </CardFooter>
          </Card>
        </fieldset>

        <aside className="space-y-6 lg:sticky lg:top-4">

          { /* Salvar */ }
          <Card>
            <CardHeader>
              <CardTitle>{editando ? 'Alterações' : 'Enviar para a cozinha'}</CardTitle>
              <CardDescription>
                {editando
                  ? 'O status não muda por aqui: use as ações abaixo.'
                  : 'Todo pedido novo entra como "Recebido".'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {exigeJustificativa && podeEditar && (
                <div className="space-y-1.5">
                  <Label htmlFor="justificativa-alteracao">Justificativa da alteração</Label>
                  <Textarea
                    id="justificativa-alteracao"
                    placeholder="Ex.: cliente pediu mais um refrigerante"
                    value={justificativa}
                    onChange={campo(setJustificativa)}
                  />
                </div>
              )}

              {erro && (
                <Alert variant="destructive">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2">
              <Button type="submit" size="lg" disabled={salvando || !podeEditar || (editando && !sujo)}>
                <Save /> {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar pedido'}
              </Button>
            </CardFooter>
          </Card>

          { /* Ações da máquina de estados */ }
          {pedido && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Etapa na cozinha</CardTitle>
                <CardDescription>
                  {pedido.prazoPreparoEm && pedido.status === 'EM_PREPARO'
                    ? `Prazo de preparo: ${formatarHora(pedido.prazoPreparoEm)}${pedido.atrasado ? ' (atrasado)' : ''}`
                    : pedido.acoesDisponiveis.length === 0
                      ? 'Nenhuma ação disponível para o seu perfil nesta etapa.'
                      : '* exige justificativa'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <AcoesPedido pedido={pedido} onExecutar={executar} desabilitado={enviando || sujo} />
                {sujo && pedido.acoesDisponiveis.length > 0 && (
                  <p className="text-xs text-muted-foreground">Salve ou recarregue as alterações antes de mudar a etapa.</p>
                )}
                {pedido.valorPerda > 0 && (
                  <p className="text-sm text-destructive">Perda registrada: {formatarMoeda(pedido.valorPerda)}</p>
                )}
                <Button asChild size="sm" variant="link" className="h-auto px-0">
                  <Link href={`/acompanhar/${pedido.id}`} target="_blank">
                    <ExternalLink /> Link de acompanhamento do cliente
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          { /* Trilha de auditoria, do mais recente para o mais antigo */ }
          {pedido && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Histórico</CardTitle>
                <CardDescription>Quem fez, quando e por quê. Nada aqui é apagado ou sobrescrito.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="max-h-96 space-y-3 overflow-y-auto pr-1">
                  {[...historico].reverse().map((h) => (
                    <li key={h.id} className="flex gap-2 text-sm">
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", etapaDoStatus(h.novoEstado).cor)} />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="flex justify-between gap-2">
                          <span className="font-medium">{ROTULO_ACAO[h.acao] ?? h.acao}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatarDataHora(h.criadoEm)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {h.estadoAnterior && h.estadoAnterior !== h.novoEstado
                            ? `${etapaDoStatus(h.estadoAnterior).titulo} → ${etapaDoStatus(h.novoEstado).titulo} · `
                            : ''}
                          {h.autor.nome} ({PAPEIS[h.autor.papel]})
                        </p>
                        {h.justificativa && <p className="rounded bg-muted px-2 py-1 text-xs">“{h.justificativa}”</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </aside>
      </form>
      {dialogo}
    </main>
  );
}
