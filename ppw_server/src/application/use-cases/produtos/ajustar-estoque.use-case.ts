import { Produto } from '../../../domain/entities/produto.entity';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { NotFoundError, RegraNegocioError, ValidationError } from '../../../domain/errors/domain.error';
import { texto } from '../../../domain/shared/normalizar';
import { UnitOfWork } from '../../ports/unit-of-work';

export interface AjusteEstoqueInput {
  // +10 = chegou mercadoria; -2 = avaria/consumo interno
  delta: unknown;
  motivo?: unknown;
}

export class AjustarEstoqueUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(produtoId: string, input: AjusteEstoqueInput, usuario: Usuario): Promise<Produto> {
    usuario.exigirPapel(['GERENTE'], 'ajustar estoque');
    const delta = Number(input.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      throw new ValidationError('Informe um ajuste inteiro diferente de zero (ex.: 10 para entrada, -2 para baixa)');
    }
    const motivo = texto(input.motivo) || (delta > 0 ? 'Entrada de mercadoria' : 'Baixa manual');

    return this.uow.executar(async (repos) => {
      const produto = await repos.produtos.findById(produtoId);
      if (!produto || !produto.ativo) {
        throw new NotFoundError(`O produto com o id = ${produtoId} não foi encontrado`);
      }
      if (!produto.controlaEstoque) {
        throw new RegraNegocioError(`${produto.nome} é feito na hora e não controla estoque`);
      }

      await repos.estoque.ajustar(produtoId, delta, { pedidoId: null, autorId: usuario.id, motivo });
      return (await repos.produtos.findById(produtoId))!;
    });
  }
}
