import { Controller, Get, MessageEvent, Param, Sse } from '@nestjs/common';
import { Observable, filter, interval, map, merge } from 'rxjs';
import { FindHistoricoPedidoUseCase } from '../../../application/use-cases/pedidos/find-historico-pedido.use-case';
import { FindPedidoByIdUseCase } from '../../../application/use-cases/pedidos/find-pedido-by-id.use-case';
import { RxPublicadorEventos } from '../../events/rx-publicador-eventos';
import { Publico } from '../auth/autenticacao.guard';

// Tela do CLIENTE final: acompanha o próprio pedido em tempo real.
// O id do pedido é um UUID (impossível de adivinhar), por isso funciona como "link secreto".
// Devolve só o necessário: sem telefone, endereço, autores ou justificativas internas.
@Publico()
@Controller('acompanhamento')
export class AcompanhamentoController {
  constructor(
    private readonly findPedidoById: FindPedidoByIdUseCase,
    private readonly findHistorico: FindHistoricoPedidoUseCase,
    private readonly eventos: RxPublicadorEventos,
  ) {}

  @Get(':id')
  async acompanhar(@Param('id') id: string) {
    const pedido = await this.findPedidoById.execute(id);
    const historico = await this.findHistorico.execute(id);
    return {
      id: pedido.id,
      numero: pedido.numero,
      cliente: pedido.cliente.split(' ')[0],
      itens: pedido.itens.map((item) => ({ nome: item.nome, quantidade: item.quantidade })),
      total: pedido.total,
      status: pedido.status,
      prazoPreparoEm: pedido.prazoPreparoEm?.toISOString() ?? null,
      atrasado: pedido.estaAtrasado(),
      linhaDoTempo: historico
        .filter((h) => h.estadoAnterior !== h.novoEstado)
        .map((h) => ({ status: h.novoEstado, em: h.criadoEm.toISOString() })),
    };
  }

  @Sse(':id/eventos')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return merge(
      this.eventos.eventos$.pipe(
        filter((evento) => evento.pedidoId === id),
        map((evento) => ({ data: { status: evento.status, versao: evento.versao } })),
      ),
      interval(25_000).pipe(map(() => ({ type: 'ping', data: '' }))),
    );
  }
}
