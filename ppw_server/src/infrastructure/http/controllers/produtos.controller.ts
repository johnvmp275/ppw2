import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CreateProdutoUseCase } from '../../../application/use-cases/produtos/create-produto.use-case';
import { DeleteProdutoUseCase } from '../../../application/use-cases/produtos/delete-produto.use-case';
import { FindAllProdutosUseCase } from '../../../application/use-cases/produtos/find-all-produtos.use-case';
import { FindProdutoByIdUseCase } from '../../../application/use-cases/produtos/find-produto-by-id.use-case';
import { UpdateProdutoUseCase } from '../../../application/use-cases/produtos/update-produto.use-case';
import { CreateProdutoDto, UpdateProdutoDto } from '../dtos/produto.dto';
import { ProdutoPresenter } from '../presenters/produto.presenter';

// O controller só recebe a requisição, chama o caso de uso e formata a resposta
@Controller('produtos')
export class ProdutosController {
  constructor(
    private readonly findAllProdutos: FindAllProdutosUseCase,
    private readonly findProdutoById: FindProdutoByIdUseCase,
    private readonly createProduto: CreateProdutoUseCase,
    private readonly updateProduto: UpdateProdutoUseCase,
    private readonly deleteProduto: DeleteProdutoUseCase,
  ) {}

  @Get()
  async findAll() {
    const produtos = await this.findAllProdutos.execute();
    return produtos.map((produto) => ProdutoPresenter.toHttp(produto));
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return ProdutoPresenter.toHttp(await this.findProdutoById.execute(id));
  }

  @Post()
  async create(@Body() dto: CreateProdutoDto) {
    return ProdutoPresenter.toHttp(await this.createProduto.execute(dto));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProdutoDto) {
    return ProdutoPresenter.toHttp(await this.updateProduto.execute(id, dto));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const produto = await this.deleteProduto.execute(id);
    return {
      message: `O produto ${produto.nome} foi removido com sucesso`,
    };
  }
}
