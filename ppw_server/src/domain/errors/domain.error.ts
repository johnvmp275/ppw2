// Erros de regra de negócio. O domínio não conhece HTTP:
// quem traduz estes erros para 400/404 é o DomainErrorFilter, na camada de infraestrutura.
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// Algum dado não respeita as regras (campo obrigatório vazio, preço inválido...)
export class ValidationError extends DomainError {}

// O registro procurado não existe
export class NotFoundError extends DomainError {}
