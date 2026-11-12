// O corpo da requisição chega sem garantia de tipo, então tudo que não for texto vira ''
export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

export function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
