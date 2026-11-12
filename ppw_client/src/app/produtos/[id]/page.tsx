import ProdutoForm from "@/components/modules/delivery/ProdutoForm";

// No Next 16 os params chegam como Promise
export default async function EditarProdutoPage({ params }: PageProps<"/produtos/[id]">){
  const { id } = await params;
  return <ProdutoForm id={id} />
}
