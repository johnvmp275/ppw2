import { InMemoryProdutoRepository } from '../../../../test/repositories/in-memory-produto.repository';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain.error';
import { CreateProdutoUseCase } from './create-produto.use-case';
import { DeleteProdutoUseCase } from './delete-produto.use-case';
import { FindProdutoByIdUseCase } from './find-produto-by-id.use-case';
import { UpdateProdutoUseCase } from './update-produto.use-case';

describe('Casos de uso de produtos', () => {
  let repository: InMemoryProdutoRepository;

  beforeEach(() => {
    repository = new InMemoryProdutoRepository();
  });

  it('cadastra um produto com categoria padrão e preço arredondado', async () => {
    const produto = await new CreateProdutoUseCase(repository).execute({ nome: '  Pudim ', preco: 8.456 });

    expect(produto.nome).toBe('Pudim');
    expect(produto.categoria).toBe('Geral');
    expect(produto.preco).toBe(8.46);
    expect(repository.produtos).toHaveLength(1);
  });

  it('não cadastra produto sem nome ou com preço inválido', async () => {
    const createProduto = new CreateProdutoUseCase(repository);

    await expect(createProduto.execute({ nome: ' ', preco: 10 })).rejects.toThrow(ValidationError);
    await expect(createProduto.execute({ nome: 'Suco', preco: 0 })).rejects.toThrow(ValidationError);
    expect(repository.produtos).toHaveLength(0);
  });

  it('altera um produto existente', async () => {
    const produto = await new CreateProdutoUseCase(repository).execute({ nome: 'Suco', preco: 9 });

    const alterado = await new UpdateProdutoUseCase(repository).execute(produto.id, {
      nome: 'Suco Natural',
      categoria: 'Bebidas',
      preco: 9.5,
    });

    expect(alterado.nome).toBe('Suco Natural');
    expect(alterado.categoria).toBe('Bebidas');
    expect(alterado.preco).toBe(9.5);
  });

  it('exclui um produto e avisa quando ele não existe mais', async () => {
    const produto = await new CreateProdutoUseCase(repository).execute({ nome: 'Suco', preco: 9 });

    await new DeleteProdutoUseCase(repository).execute(produto.id);

    expect(repository.produtos).toHaveLength(0);
    await expect(new FindProdutoByIdUseCase(repository).execute(produto.id)).rejects.toThrow(NotFoundError);
  });
});
