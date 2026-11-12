import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CreatePedidoUseCase } from '../../../application/use-cases/pedidos/create-pedido.use-case';
import { DeletePedidoUseCase } from '../../../application/use-cases/pedidos/delete-pedido.use-case';
import { FindAllPedidosUseCase } from '../../../application/use-cases/pedidos/find-all-pedidos.use-case';
import { FindPedidoByIdUseCase } from '../../../application/use-cases/pedidos/find-pedido-by-id.use-case';
import { UpdatePedidoStatusUseCase } from '../../../application/use-cases/pedidos/update-pedido-status.use-case';
import { UpdatePedidoUseCase } from '../../../application/use-cases/pedidos/update-pedido.use-case';
import { CreatePedidoDto, UpdatePedidoDto, UpdatePedidoStatusDto } from '../dtos/pedido.dto';
import { PedidoPresenter } from '../presenters/pedido.presenter';

@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly findAllPedidos: FindAllPedidosUseCase,
    private readonly findPedidoById: FindPedidoByIdUseCase,
    private readonly createPedido: CreatePedidoUseCase,
    private readonly updatePedido: UpdatePedidoUseCase,
    private readonly updatePedidoStatus: UpdatePedidoStatusUseCase,
    private readonly deletePedido: DeletePedidoUseCase,
  ) {}

  @Get()
  async findAll() {
    const pedidos = await this.findAllPedidos.execute();
    return pedidos.map((pedido) => PedidoPresenter.toHttp(pedido));
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return PedidoPresenter.toHttp(await this.findPedidoById.execute(id));
  }

  @Post()
  async create(@Body() dto: CreatePedidoDto) {
    return PedidoPresenter.toHttp(await this.createPedido.execute(dto));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePedidoDto) {
    return PedidoPresenter.toHttp(await this.updatePedido.execute(id, dto));
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdatePedidoStatusDto) {
    return PedidoPresenter.toHttp(await this.updatePedidoStatus.execute(id, dto.status));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const pedido = await this.deletePedido.execute(id);
    return {
      message: `O pedido #${pedido.numero} foi cancelado com sucesso`,
    };
  }
}
