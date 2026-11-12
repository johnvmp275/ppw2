import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { AjustarEstoqueUseCase } from '../../../application/use-cases/produtos/ajustar-estoque.use-case';
import { CreateProdutoUseCase } from '../../../application/use-cases/produtos/create-produto.use-case';
import { DeleteProdutoUseCase } from '../../../application/use-cases/produtos/delete-produto.use-case';
import { FindAllProdutosUseCase } from '../../../application/use-cases/produtos/find-all-produtos.use-case';
import { FindProdutoByIdUseCase } from '../../../application/use-cases/produtos/find-produto-by-id.use-case';
import { UpdateProdutoUseCase } from '../../../application/use-cases/produtos/update-produto.use-case';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { Publico, UsuarioAtual } from '../auth/autenticacao.guard';
import { AjusteEstoqueDto, CreateProdutoDto, UpdateProdutoDto } from '../dtos/produto.dto';
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
    private readonly ajustarEstoque: AjustarEstoqueUseCase,
  ) {}

  // O cardápio é público; mudar o cardápio é só para o gerente
  @Publico()
  @Get()
  async findAll() {
    const produtos = await this.findAllProdutos.execute();
    return produtos.map((produto) => ProdutoPresenter.toHttp(produto));
  }

  @Publico()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return ProdutoPresenter.toHttp(await this.findProdutoById.execute(id));
  }

  @Post()
  async create(@Body() dto: CreateProdutoDto, @UsuarioAtual() usuario: Usuario) {
    return ProdutoPresenter.toHttp(await this.createProduto.execute(dto, usuario));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProdutoDto, @UsuarioAtual() usuario: Usuario) {
    return ProdutoPresenter.toHttp(await this.updateProduto.execute(id, dto, usuario));
  }

  // Entrada/baixa relativa (+10, -2). Nunca "estoque = X".
  @Post(':id/estoque')
  @HttpCode(200)
  async estoque(@Param('id') id: string, @Body() dto: AjusteEstoqueDto, @UsuarioAtual() usuario: Usuario) {
    return ProdutoPresenter.toHttp(await this.ajustarEstoque.execute(id, dto, usuario));
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @UsuarioAtual() usuario: Usuario) {
    const produto = await this.deleteProduto.execute(id, usuario);
    return {
      message: `O produto ${produto.nome} saiu do cardápio`,
    };
  }
}
