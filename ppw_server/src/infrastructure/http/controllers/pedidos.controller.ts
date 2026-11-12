import { Body, Controller, Get, HttpCode, MessageEvent, Param, Post, Put, Query, Sse } from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { CreatePedidoUseCase } from '../../../application/use-cases/pedidos/create-pedido.use-case';
import { ExecutarAcaoPedidoUseCase } from '../../../application/use-cases/pedidos/executar-acao-pedido.use-case';
import { FindAllPedidosUseCase } from '../../../application/use-cases/pedidos/find-all-pedidos.use-case';
import { FindHistoricoPedidoUseCase } from '../../../application/use-cases/pedidos/find-historico-pedido.use-case';
import { FindPedidoByIdUseCase } from '../../../application/use-cases/pedidos/find-pedido-by-id.use-case';
import { LeadTimeUseCase } from '../../../application/use-cases/pedidos/lead-time.use-case';
import { UpdatePedidoUseCase } from '../../../application/use-cases/pedidos/update-pedido.use-case';
import { Pedido } from '../../../domain/entities/pedido.entity';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { MaquinaEstadosPedido } from '../../../domain/state-machine/maquina-estados-pedido';
import { RxPublicadorEventos } from '../../events/rx-publicador-eventos';
import { Publico, UsuarioAtual } from '../auth/autenticacao.guard';
import { CreatePedidoDto, ExecutarAcaoDto, UpdatePedidoDto } from '../dtos/pedido.dto';
import { PedidoPresenter } from '../presenters/pedido.presenter';

// Mantém a conexão SSE viva atrás de proxies que derrubam conexões ociosas
const HEARTBEAT_MS = 25_000;

@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly findAllPedidos: FindAllPedidosUseCase,
    private readonly findPedidoById: FindPedidoByIdUseCase,
    private readonly findHistorico: FindHistoricoPedidoUseCase,
    private readonly leadTime: LeadTimeUseCase,
    private readonly createPedido: CreatePedidoUseCase,
    private readonly updatePedido: UpdatePedidoUseCase,
    private readonly executarAcao: ExecutarAcaoPedidoUseCase,
    private readonly maquina: MaquinaEstadosPedido,
    private readonly eventos: RxPublicadorEventos,
  ) {}

  // ---- Rotas fixas antes de ":id" (o Express testa as rotas na ordem em que foram declaradas) ----

  // Server-Sent Events: o servidor empurra um aviso a cada mudança. O navegador mantém
  // UMA conexão aberta em vez de perguntar "mudou?" a cada poucos segundos (polling).
  // O evento só diz QUAL pedido mudou; o front busca os dados com o próprio perfil.
  @Publico()
  @Sse('eventos')
  stream(): Observable<MessageEvent> {
    return merge(
      this.eventos.eventos$.pipe(map((evento) => ({ data: evento }))),
      interval(HEARTBEAT_MS).pipe(map(() => ({ type: 'ping', data: '' }))),
    );
  }

  @Get('maquina-estados')
  transicoes() {
    return this.maquina.transicoes();
  }

  @Get('metricas/lead-time')
  metricas() {
    return this.leadTime.execute();
  }

  // ---- CRUD + ações ----

  @Get()
  async findAll(@UsuarioAtual() usuario: Usuario, @Query('status') status?: string) {
    const pedidos = await this.findAllPedidos.execute(status);
    return pedidos.map((pedido) => this.apresentar(pedido, usuario));
  }

  @Get(':id')
  async findById(@Param('id') id: string, @UsuarioAtual() usuario: Usuario) {
    return this.apresentar(await this.findPedidoById.execute(id), usuario);
  }

  @Get(':id/historico')
  async historico(@Param('id') id: string) {
    const registros = await this.findHistorico.execute(id);
    return registros.map((registro) => PedidoPresenter.historicoToHttp(registro));
  }

  @Post()
  async create(@Body() dto: CreatePedidoDto, @UsuarioAtual() usuario: Usuario) {
    return this.apresentar(await this.createPedido.execute(dto, usuario), usuario);
  }

  // Adicionais, remoções e dados de entrega. NÃO muda status.
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePedidoDto, @UsuarioAtual() usuario: Usuario) {
    return this.apresentar(await this.updatePedido.execute(id, dto, usuario), usuario);
  }

  // Única forma de mudar o status: POST /pedidos/:id/acoes/iniciar-preparo, /cancelar...
  @Post(':id/acoes/:acao')
  @HttpCode(200)
  async acao(
    @Param('id') id: string,
    @Param('acao') acao: string,
    @Body() dto: ExecutarAcaoDto,
    @UsuarioAtual() usuario: Usuario,
  ) {
    const pedido = await this.executarAcao.execute(
      { pedidoId: id, acao, versao: dto.versao, justificativa: dto.justificativa },
      usuario,
    );
    return this.apresentar(pedido, usuario);
  }

  private apresentar(pedido: Pedido, usuario: Usuario) {
    return PedidoPresenter.toHttp(pedido, this.maquina.acoesDisponiveis(pedido, usuario));
  }
}
