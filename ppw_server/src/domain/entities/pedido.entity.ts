import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/domain.error';
import { arredondarMoeda, texto } from '../shared/normalizar';
import { ItemPedido } from '../value-objects/item-pedido';
import { STATUS_PEDIDO, StatusPedido, isStatusPedido } from '../value-objects/status-pedido';

// Dados de quem recebe o pedido, informados no PDV ou no formulário de edição
export interface DadosEntrega {
  cliente: string;
  telefone?: string;
  endereco: string;
  observacao?: string;
}

export interface HistoricoStatus {
  status: StatusPedido;
  data: Date;
}

export interface PedidoProps {
  numero: number;
  cliente: string;
  telefone: string;
  endereco: string;
  observacao: string;
  itens: ItemPedido[];
  status: StatusPedido;
  historico: HistoricoStatus[];
  criadoEm: Date;
  atualizadoEm: Date;
}

export class Pedido {
  private constructor(
    readonly id: string,
    private props: PedidoProps,
  ) {}

  // Todo pedido novo entra na cozinha como RECEBIDO
  static criar(numero: number, dados: DadosEntrega, itens: ItemPedido[]): Pedido {
    const agora = new Date();
    return new Pedido(randomUUID(), {
      numero,
      ...Pedido.validarEntrega(dados),
      itens: Pedido.validarItens(itens),
      status: 'RECEBIDO',
      historico: [{ status: 'RECEBIDO', data: agora }],
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  // Reconstrói um pedido que já estava salvo, sem gerar id nem datas novas
  static restaurar(id: string, props: PedidoProps): Pedido {
    return new Pedido(id, { ...props });
  }

  atualizar(dados: DadosEntrega, itens: ItemPedido[]) {
    this.props = {
      ...this.props,
      ...Pedido.validarEntrega(dados),
      itens: Pedido.validarItens(itens),
      atualizadoEm: new Date(),
    };
  }

  // Move o pedido no fluxo da cozinha e registra a mudança no histórico
  alterarStatus(status: string) {
    if (!isStatusPedido(status)) {
      throw new ValidationError(`Status inválido. Use um destes: ${STATUS_PEDIDO.join(', ')}`);
    }
    if (status === this.props.status) {
      return;
    }

    const agora = new Date();
    this.props = {
      ...this.props,
      status,
      historico: [...this.props.historico, { status, data: agora }],
      atualizadoEm: agora,
    };
  }

  get numero() {
    return this.props.numero;
  }

  get cliente() {
    return this.props.cliente;
  }

  get telefone() {
    return this.props.telefone;
  }

  get endereco() {
    return this.props.endereco;
  }

  get observacao() {
    return this.props.observacao;
  }

  get itens(): readonly ItemPedido[] {
    return this.props.itens;
  }

  get status() {
    return this.props.status;
  }

  get historico(): readonly HistoricoStatus[] {
    return this.props.historico;
  }

  get criadoEm() {
    return this.props.criadoEm;
  }

  get atualizadoEm() {
    return this.props.atualizadoEm;
  }

  get total(): number {
    return arredondarMoeda(this.props.itens.reduce((soma, item) => soma + item.subtotal, 0));
  }

  private static validarEntrega(dados: DadosEntrega) {
    const cliente = texto(dados.cliente);
    const endereco = texto(dados.endereco);

    if (!cliente) {
      throw new ValidationError('O nome do cliente é obrigatório');
    }
    if (!endereco) {
      throw new ValidationError('O endereço de entrega é obrigatório');
    }

    return {
      cliente,
      telefone: texto(dados.telefone),
      endereco,
      observacao: texto(dados.observacao),
    };
  }

  private static validarItens(itens: ItemPedido[]) {
    if (itens.length === 0) {
      throw new ValidationError('O pedido precisa ter pelo menos um produto');
    }

    const repetido = itens.find((item, index) => itens.findIndex((i) => i.produtoId === item.produtoId) !== index);
    if (repetido) {
      throw new ValidationError(
        `O produto ${repetido.nome} aparece mais de uma vez. Ajuste a quantidade em vez de repetir`,
      );
    }

    return [...itens];
  }
}
