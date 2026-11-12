import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/domain.error';
import { arredondarMoeda, texto } from '../shared/normalizar';

// Dados que o usuário informa ao cadastrar ou alterar um produto
export interface DadosProduto {
  nome: string;
  descricao?: string;
  categoria?: string;
  preco: number;
  tempoPreparoMin?: number;
}

export interface DadosNovoProduto extends DadosProduto {
  // null/vazio = feito na hora (não controla estoque). Número = quantidade inicial em estoque.
  estoqueInicial?: number | null;
}

export interface ProdutoProps {
  nome: string;
  descricao: string;
  categoria: string;
  preco: number;
  tempoPreparoMin: number;
  // Leitura apenas. O estoque só muda por UPDATE atômico no banco (reservar/devolver/ajustar),
  // nunca gravando de volta um valor lido antes (isso causaria "lost update").
  estoque: number | null;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export const TEMPO_PREPARO_MAXIMO_MIN = 240;

export class Produto {
  private constructor(
    readonly id: string,
    private props: ProdutoProps,
  ) {}

  // Cria um produto novo, aplicando as regras de cadastro
  static criar(dados: DadosNovoProduto): Produto {
    const agora = new Date();
    return new Produto(randomUUID(), {
      ...Produto.validar(dados),
      estoque: Produto.validarEstoqueInicial(dados.estoqueInicial),
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  // Reconstrói um produto que já estava salvo, sem gerar id nem datas novas
  static restaurar(id: string, props: ProdutoProps): Produto {
    return new Produto(id, { ...props });
  }

  atualizar(dados: DadosProduto) {
    this.props = { ...this.props, ...Produto.validar(dados), atualizadoEm: new Date() };
  }

  get nome() {
    return this.props.nome;
  }

  get descricao() {
    return this.props.descricao;
  }

  get categoria() {
    return this.props.categoria;
  }

  get preco() {
    return this.props.preco;
  }

  get tempoPreparoMin() {
    return this.props.tempoPreparoMin;
  }

  get estoque() {
    return this.props.estoque;
  }

  get controlaEstoque() {
    return this.props.estoque !== null;
  }

  get ativo() {
    return this.props.ativo;
  }

  get criadoEm() {
    return this.props.criadoEm;
  }

  get atualizadoEm() {
    return this.props.atualizadoEm;
  }

  private static validar(dados: DadosProduto) {
    const nome = texto(dados.nome);
    const preco = Number(dados.preco);
    const tempoPreparoMin = dados.tempoPreparoMin === undefined ? 0 : Number(dados.tempoPreparoMin);

    if (!nome) {
      throw new ValidationError('O nome do produto é obrigatório');
    }
    if (!Number.isFinite(preco) || preco <= 0) {
      throw new ValidationError('O preço do produto deve ser maior que zero');
    }
    if (!Number.isInteger(tempoPreparoMin) || tempoPreparoMin < 0 || tempoPreparoMin > TEMPO_PREPARO_MAXIMO_MIN) {
      throw new ValidationError(`O tempo de preparo deve ser um número inteiro de 0 a ${TEMPO_PREPARO_MAXIMO_MIN} minutos`);
    }

    return {
      nome,
      descricao: texto(dados.descricao),
      categoria: texto(dados.categoria) || 'Geral',
      preco: arredondarMoeda(preco),
      tempoPreparoMin,
    };
  }

  private static validarEstoqueInicial(valor: unknown): number | null {
    if (valor === undefined || valor === null || valor === '') {
      return null;
    }
    const estoque = Number(valor);
    if (!Number.isInteger(estoque) || estoque < 0) {
      throw new ValidationError('O estoque inicial deve ser um número inteiro maior ou igual a zero');
    }
    return estoque;
  }
}
