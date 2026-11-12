"use client";

import { StatusPedidoBadge } from "@/components/modules/delivery/StatusPedidoBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { pedidosApi, produtosApi } from "@/lib/api";
import {
  ETAPAS,
  Pedido,
  PedidoInput,
  Produto,
  StatusPedido,
  etapaDoStatus,
  formatarDataHora,
  formatarMoeda,
  mensagemDeErro,
} from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

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

  const router = useRouter();
  const editando = Boolean(id);

  const [produtos, setProdutos] = React.useState<Produto[]>([]);
  const [pedido, setPedido] = React.useState<Pedido | null>(null);

  const [cliente, setCliente] = React.useState<string>('');
  const [telefone, setTelefone] = React.useState<string>('');
  const [endereco, setEndereco] = React.useState<string>('');
  const [observacao, setObservacao] = React.useState<string>('');
  const [status, setStatus] = React.useState<StatusPedido>('RECEBIDO');
  const [linhas, setLinhas] = React.useState<LinhaItem[]>([]);

  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [naoEncontrado, setNaoEncontrado] = React.useState<boolean>(false);
  const [salvando, setSalvando] = React.useState<boolean>(false);
  const [erro, setErro] = React.useState<string>('');

  React.useEffect(() => {
    async function carregar(){
      try {
        setProdutos(await produtosApi.listar());

        if (id) {
          const atual = await pedidosApi.buscar(id);
          setPedido(atual);
          setCliente(atual.cliente);
          setTelefone(atual.telefone);
          setEndereco(atual.endereco);
          setObservacao(atual.observacao);
          setStatus(atual.status);
          setLinhas(atual.itens.map((item) => novaLinha(item.produtoId, String(item.quantidade))));
        } else {
          setLinhas([novaLinha()]);
        }
      } catch (error) {
        setErro(mensagemDeErro(error));
        if (id) setNaoEncontrado(true);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [id]);

  // Mesma regra do servidor: item que já estava no pedido mantém o preço da venda,
  // item novo usa o preço atual do cardápio
  function precoUnitario(produtoId: string) {
    const itemOriginal = pedido?.itens.find((item) => item.produtoId === produtoId);
    if (itemOriginal) return itemOriginal.precoUnitario;
    return produtos.find((p) => p.id === produtoId)?.preco ?? 0;
  }

  function alterarLinha(chave: number, campos: Partial<LinhaItem>){
    setLinhas((atual) => atual.map((linha) => linha.chave === chave ? { ...linha, ...campos } : linha));
  }

  function removerLinha(chave: number){
    setLinhas((atual) => atual.filter((linha) => linha.chave !== chave));
  }

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
      if (id) {
        await pedidosApi.atualizar(id, { ...dados, status });
      } else {
        await pedidosApi.criar(dados);
      }
      router.push('/pedidos');
    } catch (error) {
      setErro(mensagemDeErro(error));
      setSalvando(false);
    }
  }

  async function handleExcluir(){
    if (!id || !window.confirm(`Excluir o pedido #${pedido?.numero}?`)) return;

    try {
      await pedidosApi.excluir(id);
      router.push('/pedidos');
    } catch (error) {
      setErro(mensagemDeErro(error));
    }
  }

  // Produtos agrupados por categoria para o <select> de cada item
  const categorias = [...new Set(produtos.map((p) => p.categoria))].sort();
  // Itens do pedido cujo produto já saiu do cardápio continuam selecionáveis
  const foraDoCardapio = (pedido?.itens ?? []).filter((item) => !produtos.some((p) => p.id === item.produtoId));

  const total = linhas.reduce((soma, linha) => soma + precoUnitario(linha.produtoId) * (Number(linha.quantidade) || 0), 0);

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
      </div>

      <form onSubmit={handleSalvar} className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">

          { /* Cliente e entrega */ }
          <Card>
            <CardHeader>
              <CardTitle>Cliente e entrega</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cliente">Cliente</Label>
                <Input id="cliente" required value={cliente} onChange={(e) => setCliente(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  type="tel"
                  placeholder="Opcional"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="endereco">Endereço de entrega</Label>
                <Input id="endereco" required value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="observacao">Observação</Label>
                <Textarea
                  id="observacao"
                  placeholder="Ex.: sem cebola, troco para R$ 50"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          { /* Itens */ }
          <Card>
            <CardHeader>
              <CardTitle>Itens</CardTitle>
              <CardDescription>O preço vem do cadastro de produtos.</CardDescription>
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
                              <option key={p.id} value={p.id} disabled={usadoEmOutraLinha(p.id)}>
                                {p.nome} · {formatarMoeda(p.preco)}
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
                onClick={() => setLinhas((atual) => [...atual, novaLinha()])}
              >
                <Plus /> Adicionar item
              </Button>
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="text-xl font-bold tabular-nums">{formatarMoeda(total)}</span>
            </CardFooter>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4">

          { /* Status e ações */ }
          <Card>
            <CardHeader>
              <CardTitle>{editando ? 'Etapa na cozinha' : 'Enviar para a cozinha'}</CardTitle>
              {!editando && (
                <CardDescription>Todo pedido novo entra como &quot;Recebido&quot;.</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {editando && (
                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <NativeSelect
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusPedido)}
                  >
                    {ETAPAS.map((etapa) => (
                      <option key={etapa.status} value={etapa.status}>{etapa.titulo}</option>
                    ))}
                  </NativeSelect>
                </div>
              )}

              {erro && (
                <Alert variant="destructive">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2">
              <Button type="submit" size="lg" disabled={salvando}>
                <Save /> {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar pedido'}
              </Button>
              <Button asChild variant="outline">
                <Link href="/pedidos">Cancelar</Link>
              </Button>
              {editando && (
                <Button type="button" variant="destructive" onClick={handleExcluir}>
                  <Trash2 /> Excluir pedido
                </Button>
              )}
            </CardFooter>
          </Card>

          { /* Histórico de status, do mais recente para o mais antigo */ }
          {pedido && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Histórico</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {[...pedido.historico].reverse().map((h, index) => (
                    <li key={`${h.data}-${index}`} className="flex items-center gap-2 text-sm">
                      <span className={cn("size-2 shrink-0 rounded-full", etapaDoStatus(h.status).cor)} />
                      <span className="flex-1">{etapaDoStatus(h.status).titulo}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatarDataHora(h.data)}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </aside>
      </form>
    </main>
  );
}
