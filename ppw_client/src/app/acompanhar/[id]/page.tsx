import Acompanhar from "@/components/modules/delivery/Acompanhar";

// Página do cliente final (link enviado por WhatsApp, por exemplo)
export default async function AcompanharPage({ params }: PageProps<"/acompanhar/[id]">){
  const { id } = await params;
  return <Acompanhar id={id} />
}
