// Erros de regra de negócio. O domínio não conhece HTTP:
// quem traduz estes erros para 400/401/403/404/409/422 é o DomainErrorFilter, na camada de infraestrutura.
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// 400 - Algum dado não respeita o formato esperado (campo obrigatório vazio, preço inválido...)
export class ValidationError extends DomainError {}

// 404 - O registro procurado não existe
export class NotFoundError extends DomainError {}

// 401 - Não sabemos quem está fazendo a requisição
export class NaoAutenticadoError extends DomainError {}

// 403 - O usuário é conhecido, mas o papel dele não permite a ação
export class PermissaoNegadaError extends DomainError {}

// 409 - Outra requisição alterou o mesmo recurso antes (versão desatualizada, estoque que acabou...)
export class ConflitoError extends DomainError {}

// 422 - O pedido está bem formado, mas fere uma regra de negócio
export class RegraNegocioError extends DomainError {}

// 422 - A ação não sai do estado atual do pedido (ex.: "despachar" um pedido que ainda está RECEBIDO)
export class TransicaoInvalidaError extends RegraNegocioError {}

// 422 - A ação sai do estado atual, mas uma condição obrigatória não foi cumprida (guarda de transição)
export class GuardaTransicaoError extends RegraNegocioError {}
