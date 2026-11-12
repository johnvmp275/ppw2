"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { produtosApi } from "@/lib/api";
import { Produto, ProdutoInput, mensagemDeErro } from "@/lib/delivery";
import { ArrowLeft, PackagePlus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

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
  const [tempoPreparo, setTempoPreparo] = React.useState<string>('0');
  const [descricao, setDescricao] = React.useState<string>('');
  // Só no cadastro. Vazio = feito na hora (não controla estoque)
  const [estoqueInicial, setEstoqueInicial] = React.useState<string>('');

  const [produto, setProduto] = React.useState<Produto | null>(null);
  const [ajuste, setAjuste] = React.useState<string>('');
  const [motivoAjuste, setMotivoAjuste] = React.useState<string>('');

  const [categorias, setCategorias] = React.useState<string[]>([]);
  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [naoEncontrado, setNaoEncontrado] = React.useState<boolean>(false);
  const [salvando, setSalvando] = React.useState<boolean>(false);
  const [erro, setErro] = React.useState<string>('');

  function preencher(p: Produto) {
    setProduto(p);
    setNome(p.nome);
    setCategoria(p.categoria);
    setPreco(String(p.preco));
    setTempoPreparo(String(p.tempoPreparoMin));
    setDescricao(p.descricao);
  }

  React.useEffect(() => {
    async function carregar(){
      try {
        // As categorias existentes viram sugestões no campo Categoria
        const produtos = await produtosApi.listar();
        setCategorias([...new Set(produtos.map((p) => p.categoria))].sort());
        if (id) preencher(await produtosApi.buscar(id));
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

    const dados: ProdutoInput = { nome, categoria, descricao, preco: Number(preco), tempoPreparoMin: Number(tempoPreparo) };
    try {
      if (id) {
        preencher(await produtosApi.atualizar(id, dados));
        toast.success('Produto alterado');
      } else {
        const criado = await produtosApi.criar({
          ...dados,
          estoqueInicial: estoqueInicial === '' ? null : Number(estoqueInicial),
        });
        toast.success(`${criado.nome} entrou no cardápio`);
        setNome(''); setCategoria(''); setPreco(''); setTempoPreparo('0'); setDescricao(''); setEstoqueInicial('');
      }
    } catch (error) {
      setErro(mensagemDeErro(error));
    } finally {
      setSalvando(false);
    }
  }

  // Entrada/baixa relativa: o servidor faz estoque = estoque + delta numa única instrução,
  // então uma venda que aconteça ao mesmo tempo não é perdida
  async function handleAjustarEstoque(e: React.SubmitEvent){
    e.preventDefault();
    if (!id) return;
    try {
      const atualizado = await produtosApi.ajustarEstoque(id, Number(ajuste), motivoAjuste);
      setProduto(atualizado);
      setAjuste('');
      setMotivoAjuste('');
      toast.success(`Estoque de ${atualizado.nome}: ${atualizado.estoque}`);
    } catch (error) {
      toast.error(mensagemDeErro(error));
    }
  }

  async function handleExcluir(){
    if (!id || !window.confirm(`Tirar "${nome}" do cardápio? Pedidos já feitos não são afetados.`)) return;

    try {
      const { message } = await produtosApi.excluir(id);
      toast.success(message);
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
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">{editando ? 'Editar produto' : 'Novo produto'}</CardTitle>
              <CardDescription>
                {editando
                  ? 'Mudar o preço vale para os próximos pedidos. Os pedidos já feitos mantêm o preço da venda.'
                  : 'O produto aparece no PDV assim que for cadastrado. Somente o gerente altera o cardápio.'}
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSalvar} className="contents">
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" required placeholder="Ex.: Marmita Executiva" value={nome} onChange={(e) => setNome(e.target.value)} />
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
                  <Input id="preco" required type="number" min="0.01" step="0.01" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tempo">Tempo de preparo (min)</Label>
                  <Input id="tempo" required type="number" min="0" max="240" step="1" value={tempoPreparo} onChange={(e) => setTempoPreparo(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Define o prazo (SLA) da cozinha.</p>
                </div>

                {!editando && (
                  <div className="space-y-1.5">
                    <Label htmlFor="estoque">Estoque inicial</Label>
                    <Input id="estoque" type="number" min="0" step="1" placeholder="Vazio = feito na hora" value={estoqueInicial} onChange={(e) => setEstoqueInicial(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Preencha para itens prontos (latas, sobremesas).</p>
                  </div>
                )}

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea id="descricao" placeholder="Ingredientes, tamanho..." value={descricao} onChange={(e) => setDescricao(e.target.value)} />
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
                {editando && (
                  <Button type="button" variant="destructive" className="ml-auto" onClick={handleExcluir}>
                    <Trash2 /> Tirar do cardápio
                  </Button>
                )}
              </CardFooter>
            </form>
          </Card>

          {produto && produto.estoque !== null && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Estoque: {produto.estoque} unidade(s)</CardTitle>
                <CardDescription>
                  Informe quanto entrou (ex.: 12) ou saiu (ex.: -2). O valor final não é digitado para não
                  apagar vendas feitas enquanto esta tela estava aberta.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleAjustarEstoque} className="contents">
                <CardContent className="flex flex-wrap items-end gap-2">
                  <div className="w-28 space-y-1.5">
                    <Label htmlFor="ajuste">Ajuste</Label>
                    <Input id="ajuste" required type="number" step="1" value={ajuste} onChange={(e) => setAjuste(e.target.value)} />
                  </div>
                  <div className="min-w-48 flex-1 space-y-1.5">
                    <Label htmlFor="motivo">Motivo</Label>
                    <Input id="motivo" placeholder="Ex.: chegou mercadoria" value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value)} />
                  </div>
                  <Button type="submit" variant="outline" disabled={!ajuste || Number(ajuste) === 0}>
                    <PackagePlus /> Ajustar
                  </Button>
                </CardContent>
              </form>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
