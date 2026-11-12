"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { produtosApi } from "@/lib/api";
import { mensagemDeErro } from "@/lib/delivery";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

interface ProdutoFormProps {
  // Sem id o formulário cadastra; com id ele carrega o produto e altera
  id?: string;
}

export default function ProdutoForm({ id }: ProdutoFormProps) {

  const router = useRouter();
  const editando = Boolean(id);

  const [nome, setNome] = React.useState<string>('');
  const [categoria, setCategoria] = React.useState<string>('');
  const [preco, setPreco] = React.useState<string>('');
  const [descricao, setDescricao] = React.useState<string>('');

  const [categorias, setCategorias] = React.useState<string[]>([]);
  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [naoEncontrado, setNaoEncontrado] = React.useState<boolean>(false);
  const [salvando, setSalvando] = React.useState<boolean>(false);
  const [erro, setErro] = React.useState<string>('');

  React.useEffect(() => {
    async function carregar(){
      try {
        // As categorias existentes viram sugestões no campo Categoria
        const produtos = await produtosApi.listar();
        setCategorias([...new Set(produtos.map((p) => p.categoria))].sort());

        if (id) {
          const produto = await produtosApi.buscar(id);
          setNome(produto.nome);
          setCategoria(produto.categoria);
          setPreco(String(produto.preco));
          setDescricao(produto.descricao);
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

  async function handleSalvar(e: React.SubmitEvent){
    e.preventDefault();
    setSalvando(true);
    setErro('');

    const dados = { nome, categoria, descricao, preco: Number(preco) };
    try {
      if (id) {
        await produtosApi.atualizar(id, dados);
      } else {
        await produtosApi.criar(dados);
      }
      router.push('/produtos');
    } catch (error) {
      setErro(mensagemDeErro(error));
      setSalvando(false);
    }
  }

  async function handleExcluir(){
    if (!id || !window.confirm(`Excluir o produto "${nome}"? Pedidos já feitos não são afetados.`)) return;

    try {
      await produtosApi.excluir(id);
      router.push('/produtos');
    } catch (error) {
      setErro(mensagemDeErro(error));
    }
  }

  return (
    <main className="container mx-auto max-w-2xl space-y-4 px-4 py-8">
      <Link
        href="/produtos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Produtos
      </Link>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : naoEncontrado ? (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">{editando ? 'Editar produto' : 'Novo produto'}</CardTitle>
            <CardDescription>
              {editando
                ? 'Mudar o preço vale para os próximos pedidos. Os pedidos já feitos mantêm o preço da venda.'
                : 'O produto aparece no PDV assim que for cadastrado.'}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSalvar} className="contents">
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  required
                  placeholder="Ex.: Marmita Executiva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="categoria">Categoria</Label>
                <Input
                  id="categoria"
                  list="categorias"
                  placeholder="Ex.: Marmitas, Bebidas..."
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
                <datalist id="categorias">
                  {categorias.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="preco">Preço (R$)</Label>
                <Input
                  id="preco"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Ingredientes, tamanho..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>

              {erro && (
                <Alert variant="destructive" className="sm:col-span-2">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex-wrap gap-2">
              <Button type="submit" disabled={salvando}>
                <Save /> {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar produto'}
              </Button>
              <Button asChild variant="outline">
                <Link href="/produtos">Cancelar</Link>
              </Button>
              {editando && (
                <Button type="button" variant="destructive" className="ml-auto" onClick={handleExcluir}>
                  <Trash2 /> Excluir
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      )}
    </main>
  );
}
