import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { CreatePedidoUseCase } from '../../application/use-cases/pedidos/create-pedido.use-case';
import { DeletePedidoUseCase } from '../../application/use-cases/pedidos/delete-pedido.use-case';
import { FindAllPedidosUseCase } from '../../application/use-cases/pedidos/find-all-pedidos.use-case';
import { FindPedidoByIdUseCase } from '../../application/use-cases/pedidos/find-pedido-by-id.use-case';
import { UpdatePedidoStatusUseCase } from '../../application/use-cases/pedidos/update-pedido-status.use-case';
import { UpdatePedidoUseCase } from '../../application/use-cases/pedidos/update-pedido.use-case';
import { CreateProdutoUseCase } from '../../application/use-cases/produtos/create-produto.use-case';
import { DeleteProdutoUseCase } from '../../application/use-cases/produtos/delete-produto.use-case';
import { FindAllProdutosUseCase } from '../../application/use-cases/produtos/find-all-produtos.use-case';
import { FindProdutoByIdUseCase } from '../../application/use-cases/produtos/find-produto-by-id.use-case';
import { UpdateProdutoUseCase } from '../../application/use-cases/produtos/update-produto.use-case';
import { PedidoRepository } from '../../domain/repositories/pedido.repository';
import { ProdutoRepository } from '../../domain/repositories/produto.repository';
import { DatabaseModule } from '../database/database.module';
import { PedidosController } from './controllers/pedidos.controller';
import { ProdutosController } from './controllers/produtos.controller';
import { DomainErrorFilter } from './filters/domain-error.filter';
import { DefaultBodyPipe } from './pipes/default-body.pipe';
import { useCaseProvider } from './use-case.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [ProdutosController, PedidosController],
  providers: [
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    { provide: APP_PIPE, useClass: DefaultBodyPipe },

    useCaseProvider(FindAllProdutosUseCase, [ProdutoRepository]),
    useCaseProvider(FindProdutoByIdUseCase, [ProdutoRepository]),
    useCaseProvider(CreateProdutoUseCase, [ProdutoRepository]),
    useCaseProvider(UpdateProdutoUseCase, [ProdutoRepository]),
    useCaseProvider(DeleteProdutoUseCase, [ProdutoRepository]),

    useCaseProvider(FindAllPedidosUseCase, [PedidoRepository]),
    useCaseProvider(FindPedidoByIdUseCase, [PedidoRepository]),
    useCaseProvider(CreatePedidoUseCase, [PedidoRepository, ProdutoRepository]),
    useCaseProvider(UpdatePedidoUseCase, [PedidoRepository, ProdutoRepository]),
    useCaseProvider(UpdatePedidoStatusUseCase, [PedidoRepository]),
    useCaseProvider(DeletePedidoUseCase, [PedidoRepository]),
  ],
})
export class HttpModule {}
