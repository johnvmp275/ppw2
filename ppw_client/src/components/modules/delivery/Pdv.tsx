"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pedidosApi, produtosApi } from "@/lib/api";
import { Pedido, Produto, formatarMoeda, mensagemDeErro } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import React from "react";

interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

export default function Pdv() {

  const [produtos, setProdutos] = React.useState<Produto[]>([]);
  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [busca, setBusca] = React.useState<string>('');
  const [categoria, setCategoria] = React.useState<string>('Todas');

  const [carrinho, setCarrinho] = React.useState<ItemCarrinho[]>([]);
  const [cliente, setCliente] = React.useState<string>('');
  const [telefone, setTelefone] = React.useState<string>('');
  const [endereco, setEndereco] = React.useState<string>('');
  const [observacao, setObservacao] = React.useState<string>('');

  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [erro, setErro] = React.useState<string>('');
  const [ultimoPedido, setUltimoPedido] = React.useState<Pedido | null>(null);

  async function fetchProdutos(){
    try {
      setProdutos(await produtosApi.listar());
    } catch (error) {
      setStatus('error');
      setErro(mensagemDeErro(error));
    } finally {
      setCarregando(false);
    }
  }

  React.useEffect(() => {
    fetchProdutos();
  }, []);

  function adicionarProduto(produto: Produto){
    setCarrinho((atual) => {
      const existente = atual.find((item) => item.produto.id === produto.id);
      if (existente) {
        return atual.map((item) =>
          item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }
      return [...atual, { produto, quantidade: 1 }];
    });
  }

  function alterarQuantidade(produtoId: string, delta: number){
    setCarrinho((atual) =>
      atual
        .map((item) => item.produto.id === produtoId ? { ...item, quantidade: item.quantidade + delta } : item)
        .filter((item) => item.quantidade > 0)
    );
  }

  function removerItem(produtoId: string){
    setCarrinho((atual) => atual.filter((item) => item.produto.id !== produtoId));
  }

  async function handleEnviarPedido(e: React.SubmitEvent){
    e.preventDefault();
    if (carrinho.length === 0) return;

    setStatus('loading');
    try {
      const pedido = await pedidosApi.criar({
        cliente,
        telefone,
        endereco,
        observacao,
        itens: carrinho.map((item) => ({ produtoId: item.produto.id, quantidade: item.quantidade })),
      });

      setUltimoPedido(pedido);
      setStatus('success');
      setCarrinho([]);
      setCliente('');
      setTelefone('');
      setEndereco('');
      setObservacao('');
    } catch (error) {
      setErro(mensagemDeErro(error));
      setStatus('error');
    }
  }

  const categorias = ['Todas', ...new Set(produtos.map((p) => p.categoria))];

  const produtosFiltrados = produtos.filter((p) =>
    (categoria === 'Todas' || p.categoria === categoria) &&
    p.nome.toLowerCase().includes(busca.trim().toLowerCase())
  );

  const total = carrinho.reduce((soma, item) => soma + item.produto.preco * item.quantidade, 0);
  const quantidadeNoCarrinho = (id: string) => carrinho.find((item) => item.produto.id === id)?.quantidade ?? 0;

  return (
    <main className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[1fr_400px]">

      { /* Catálogo */ }
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Novo pedido</h1>
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto"
              className="pl-8"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={categoria === c ? "default" : "outline"}
              onClick={() => setCategoria(c)}
            >
              {c}
            </Button>
          ))}
        </div>

        {!carregando && produtos.length === 0 && status !== 'error' && (
          <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            Nenhum produto cadastrado.{" "}
            <Link href="/produtos" className="font-medium text-foreground underline">
              Cadastre produtos
            </Link>{" "}
            para montar pedidos.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {produtosFiltrados.map((produto) => {
            const quantidade = quantidadeNoCarrinho(produto.id);
            return (
              <button
                key={produto.id}
                type="button"
                onClick={() => adicionarProduto(produto)}
                className={cn(
                  "relative flex flex-col gap-1 rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 transition hover:ring-primary active:translate-y-px",
                  quantidade > 0 && "ring-2 ring-primary"
                )}
              >
                {quantidade > 0 && (
                  <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {quantidade}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{produto.categoria}</span>
                <span className="pr-6 font-medium leading-snug">{produto.nome}</span>
                {produto.descricao && (
                  <span className="line-clamp-2 text-xs text-muted-foreground">{produto.descricao}</span>
                )}
                <span className="mt-auto pt-2 font-semibold">{formatarMoeda(produto.preco)}</span>
              </button>
            );
          })}
        </div>
      </section>

      { /* Pedido em montagem */ }
      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Pedido atual</CardTitle>
        </CardHeader>

        <form onSubmit={handleEnviarPedido} className="contents">
          <CardContent className="space-y-4">
            {carrinho.length === 0 ? (
              <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                Clique nos produtos para adicioná-los ao pedido
              </p>
            ) : (
              <ul className="divide-y">
                {carrinho.map((item) => (
                  <li key={item.produto.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.produto.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatarMoeda(item.produto.preco)} × {item.quantidade} = {formatarMoeda(item.produto.preco * item.quantidade)}
                      </p>
                    </div>
                    <Button type="button" size="icon-xs" variant="outline" aria-label="Diminuir" onClick={() => alterarQuantidade(item.produto.id, -1)}>
                      <Minus />
                    </Button>
                    <span className="w-5 text-center tabular-nums">{item.quantidade}</span>
                    <Button type="button" size="icon-xs" variant="outline" aria-label="Aumentar" onClick={() => alterarQuantidade(item.produto.id, 1)}>
                      <Plus />
                    </Button>
                    <Button type="button" size="icon-xs" variant="ghost" className="text-destructive" aria-label="Remover" onClick={() => removerItem(item.produto.id)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <Input required placeholder="Nome do cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
              <Input placeholder="Telefone (opcional)" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              <Input required placeholder="Endereço de entrega" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              <Input placeholder="Observação (ex.: sem cebola)" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>

            {status === 'success' && ultimoPedido && (
              <Alert>
                <AlertDescription>
                  Pedido #{ultimoPedido.numero} enviado para a cozinha.{" "}
                  <Link href="/cozinha" className="font-medium text-foreground underline">Ver na cozinha</Link>
                </AlertDescription>
              </Alert>
            )}
            {status === 'error' && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="text-2xl font-bold">{formatarMoeda(total)}</span>
            </div>
            <Button type="submit" size="lg" disabled={carrinho.length === 0 || status === 'loading'}>
              {status === 'loading' ? 'Enviando...' : 'Enviar para a cozinha'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
