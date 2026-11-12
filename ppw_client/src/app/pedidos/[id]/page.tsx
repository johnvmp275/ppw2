import PedidoForm from "@/components/modules/delivery/PedidoForm";

// No Next 16 os params chegam como Promise
export default async function EditarPedidoPage({ params }: PageProps<"/pedidos/[id]">){
  const { id } = await params;
  return <PedidoForm id={id} />
}
