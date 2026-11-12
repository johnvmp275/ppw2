import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { PublicadorEventos } from '../../application/ports/publicador-eventos';
import { UnitOfWork } from '../../application/ports/unit-of-work';
import { CreatePedidoUseCase } from '../../application/use-cases/pedidos/create-pedido.use-case';
import { ExecutarAcaoPedidoUseCase } from '../../application/use-cases/pedidos/executar-acao-pedido.use-case';
import { FindAllPedidosUseCase } from '../../application/use-cases/pedidos/find-all-pedidos.use-case';
import { FindHistoricoPedidoUseCase } from '../../application/use-cases/pedidos/find-historico-pedido.use-case';
import { FindPedidoByIdUseCase } from '../../application/use-cases/pedidos/find-pedido-by-id.use-case';
import { LeadTimeUseCase } from '../../application/use-cases/pedidos/lead-time.use-case';
import { UpdatePedidoUseCase } from '../../application/use-cases/pedidos/update-pedido.use-case';
import { AjustarEstoqueUseCase } from '../../application/use-cases/produtos/ajustar-estoque.use-case';
import { CreateProdutoUseCase } from '../../application/use-cases/produtos/create-produto.use-case';
import { DeleteProdutoUseCase } from '../../application/use-cases/produtos/delete-produto.use-case';
import { FindAllProdutosUseCase } from '../../application/use-cases/produtos/find-all-produtos.use-case';
import { FindProdutoByIdUseCase } from '../../application/use-cases/produtos/find-produto-by-id.use-case';
import { UpdateProdutoUseCase } from '../../application/use-cases/produtos/update-produto.use-case';
import { HistoricoRepository } from '../../domain/repositories/historico.repository';
import { PedidoRepository } from '../../domain/repositories/pedido.repository';
import { ProdutoRepository } from '../../domain/repositories/produto.repository';
import { MaquinaEstadosPedido, criarMaquinaEstadosPedido } from '../../domain/state-machine/maquina-estados-pedido';
import { DatabaseModule } from '../database/database.module';
import { RxPublicadorEventos } from '../events/rx-publicador-eventos';
import { AutenticacaoGuard } from './auth/autenticacao.guard';
import { AcompanhamentoController } from './controllers/acompanhamento.controller';
import { PedidosController } from './controllers/pedidos.controller';
import { ProdutosController } from './controllers/produtos.controller';
import { UsuariosController } from './controllers/usuarios.controller';
import { DomainErrorFilter } from './filters/domain-error.filter';
import { DefaultBodyPipe } from './pipes/default-body.pipe';
import { useCaseProvider } from './use-case.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [ProdutosController, PedidosController, AcompanhamentoController, UsuariosController],
  providers: [
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    { provide: APP_PIPE, useClass: DefaultBodyPipe },
    { provide: APP_GUARD, useClass: AutenticacaoGuard },

    // Observer: uma instância só, usada para publicar (casos de uso) e assinar (SSE)
    RxPublicadorEventos,
    { provide: PublicadorEventos, useExisting: RxPublicadorEventos },
    { provide: MaquinaEstadosPedido, useFactory: criarMaquinaEstadosPedido },

    useCaseProvider(FindAllProdutosUseCase, [ProdutoRepository]),
    useCaseProvider(FindProdutoByIdUseCase, [ProdutoRepository]),
    useCaseProvider(CreateProdutoUseCase, [ProdutoRepository]),
    useCaseProvider(UpdateProdutoUseCase, [ProdutoRepository]),
    useCaseProvider(DeleteProdutoUseCase, [ProdutoRepository]),
    useCaseProvider(AjustarEstoqueUseCase, [UnitOfWork]),

    useCaseProvider(FindAllPedidosUseCase, [PedidoRepository]),
    useCaseProvider(FindPedidoByIdUseCase, [PedidoRepository]),
    useCaseProvider(FindHistoricoPedidoUseCase, [PedidoRepository, HistoricoRepository]),
    useCaseProvider(LeadTimeUseCase, [HistoricoRepository]),
    useCaseProvider(CreatePedidoUseCase, [UnitOfWork, PublicadorEventos]),
    useCaseProvider(UpdatePedidoUseCase, [UnitOfWork, PublicadorEventos]),
    useCaseProvider(ExecutarAcaoPedidoUseCase, [UnitOfWork, MaquinaEstadosPedido, PublicadorEventos]),
  ],
})
export class HttpModule {}
