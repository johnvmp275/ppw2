const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Um id fora do formato UUID faria o PostgreSQL lançar erro de sintaxe (22P02).
// Para quem chama, "id inválido" e "id inexistente" são a mesma coisa: não encontrado.
export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor);
}
