import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/domain.error';
import { arredondarMoeda, texto } from '../shared/normalizar';
import { ItemPedido } from '../value-objects/item-pedido';
import { StatusPedido } from '../value-objects/status-pedido';

// Dados de quem recebe o pedido, informados no PDV ou no formulário de edição
export interface DadosEntrega {
  cliente: string;
  telefone?: string;
  endereco: string;
  observacao?: string;
}

export interface PedidoProps {
  // Número de exibição (#1, #2...). Vem de uma SEQUENCE do banco: null até o pedido ser gravado.
  numero: number | null;
  cliente: string;
  telefone: string;
  endereco: string;
  observacao: string;
  itens: ItemPedido[];
  status: StatusPedido;
  // Controle de concorrência otimista: toda gravação incrementa; quem tentar gravar
  // com uma versão antiga recebe 409.
  versao: number;
  criadoPorId: string;
  entregadorId: string | null;
  // SLA da cozinha: definido quando o preparo começa
  prazoPreparoEm: Date | null;
  // Valor dos itens perdidos em cancelamentos/remoções durante a produção
  valorPerda: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

// Raiz do agregado Pedido.
// Repare que não existe um "setStatus" público para formulários: o status só muda
// por aplicarTransicao(), chamado pelas ações da máquina de estados.
export class Pedido {
  private constructor(
    readonly id: string,
    private props: PedidoProps,
  ) {}

  // Todo pedido novo entra na cozinha como RECEBIDO
  static criar(dados: DadosEntrega, itens: ItemPedido[], criadoPorId: string): Pedido {
    const agora = new Date();
    return new Pedido(randomUUID(), {
      numero: null,
      ...Pedido.validarEntrega(dados),
      itens: Pedido.validarItens(itens),
      status: 'RECEBIDO',
      versao: 1,
      criadoPorId,
      entregadorId: null,
      prazoPreparoEm: null,
      valorPerda: 0,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  // Reconstrói um pedido que já estava salvo, sem gerar id nem datas novas
  static restaurar(id: string, props: PedidoProps): Pedido {
    return new Pedido(id, { ...props, itens: [...props.itens] });
  }

  alterarDados(dados: DadosEntrega, itens: ItemPedido[]) {
    this.props = {
      ...this.props,
      ...Pedido.validarEntrega(dados),
      itens: Pedido.validarItens(itens),
      atualizadoEm: new Date(),
    };
  }

  // ----- Usados SOMENTE pelas ações da máquina de estados -----

  aplicarTransicao(destino: StatusPedido, agora: Date) {
    this.props = { ...this.props, status: destino, atualizadoEm: agora };
  }

  definirPrazoPreparo(prazo: Date) {
    this.props = { ...this.props, prazoPreparoEm: prazo };
  }

  atribuirEntregador(entregadorId: string) {
    this.props = { ...this.props, entregadorId };
  }

  registrarPerda(valor: number) {
    this.props = { ...this.props, valorPerda: arredondarMoeda(this.props.valorPerda + valor) };
  }

  // ----- Usados pelo repositório -----

  atribuirNumero(numero: number) {
    this.props = { ...this.props, numero };
  }

  // Chamado depois que o UPDATE ... WHERE versao = :versao deu certo
  confirmarGravacao() {
    this.props = { ...this.props, versao: this.props.versao + 1 };
  }

  // ----- Leitura -----

  // SLA estourado: o preparo começou e o prazo passou sem o pedido ficar pronto
  estaAtrasado(agora = new Date()): boolean {
    return this.props.status === 'EM_PREPARO' && !!this.props.prazoPreparoEm && agora > this.props.prazoPreparoEm;
  }

  // Maior tempo de preparo entre os itens: os pratos são feitos em paralelo
  get tempoPreparoMin(): number {
    return Math.max(0, ...this.props.itens.map((item) => item.tempoPreparoMin));
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

  get versao() {
    return this.props.versao;
  }

  get criadoPorId() {
    return this.props.criadoPorId;
  }

  get entregadorId() {
    return this.props.entregadorId;
  }

  get prazoPreparoEm() {
    return this.props.prazoPreparoEm;
  }

  get valorPerda() {
    return this.props.valorPerda;
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
