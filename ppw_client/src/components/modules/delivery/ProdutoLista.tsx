"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { produtosApi } from "@/lib/api";
import { Produto, formatarMoeda, mensagemDeErro } from "@/lib/delivery";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import React from "react";

export default function ProdutoLista() {

  const [produtos, setProdutos] = React.useState<Produto[]>([]);
  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [erro, setErro] = React.useState<string>('');
  const [mensagem, setMensagem] = React.useState<string>('');

  const [busca, setBusca] = React.useState<string>('');
  const [categoria, setCategoria] = React.useState<string>('Todas');

  async function fetchProdutos(){
    try {
      setProdutos(await produtosApi.listar());
      setErro('');
    } catch (error) {
      setErro(mensagemDeErro(error));
    } finally {
      setCarregando(false);
    }
  }

  React.useEffect(() => {
    fetchProdutos();
  }, []);

  async function handleDeleteProduto(produto: Produto){
    if (!window.confirm(`Excluir o produto "${produto.nome}"? Pedidos já feitos não são afetados.`)) return;

    try {
      const { message } = await produtosApi.excluir(produto.id);
      setMensagem(message);
      fetchProdutos();
    } catch (error) {
      setMensagem('');
      setErro(mensagemDeErro(error));
    }
  }

  const categorias = ['Todas', ...[...new Set(produtos.map((p) => p.categoria))].sort()];

  const produtosFiltrados = produtos
    .filter((p) =>
      (categoria === 'Todas' || p.categoria === categoria) &&
      p.nome.toLowerCase().includes(busca.trim().toLowerCase())
    )
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));

  return (
    <main className="container mx-auto space-y-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">{produtos.length} produto(s) no cardápio</p>
        </div>
        <Button asChild>
          <Link href="/produtos/novo"><Plus /> Novo produto</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar pelo nome"
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
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

      {mensagem && (
        <Alert>
          <AlertDescription>{mensagem}</AlertDescription>
        </Alert>
      )}
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="w-24 pr-4 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtosFiltrados.map((produto) => (
              <TableRow key={produto.id}>
                <TableCell className="max-w-md pl-4">
                  <p className="font-medium">{produto.nome}</p>
                  {produto.descricao && (
                    <p className="truncate text-xs text-muted-foreground">{produto.descricao}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{produto.categoria}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatarMoeda(produto.preco)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`Editar ${produto.nome}`}>
                      <Link href={`/produtos/${produto.id}`}><Pencil /></Link>
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive"
                      aria-label={`Excluir ${produto.nome}`}
                      onClick={() => handleDeleteProduto(produto)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {!carregando && produtosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  {produtos.length === 0 ? 'Nenhum produto cadastrado ainda' : 'Nenhum produto encontrado com esses filtros'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </main>
  );
}
