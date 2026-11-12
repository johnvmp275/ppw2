import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/domain.error';
import { arredondarMoeda, texto } from '../shared/normalizar';

// Dados que o usuário informa ao cadastrar ou alterar um produto
export interface DadosProduto {
  nome: string;
  descricao?: string;
  categoria?: string;
  preco: number;
}

export interface ProdutoProps {
  nome: string;
  descricao: string;
  categoria: string;
  preco: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

export class Produto {
  private constructor(
    readonly id: string,
    private props: ProdutoProps,
  ) {}

  // Cria um produto novo, aplicando as regras de cadastro
  static criar(dados: DadosProduto): Produto {
    const agora = new Date();
    return new Produto(randomUUID(), { ...Produto.validar(dados), criadoEm: agora, atualizadoEm: agora });
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

  get criadoEm() {
    return this.props.criadoEm;
  }

  get atualizadoEm() {
    return this.props.atualizadoEm;
  }

  private static validar(dados: DadosProduto) {
    const nome = texto(dados.nome);
    const preco = Number(dados.preco);

    if (!nome) {
      throw new ValidationError('O nome do produto é obrigatório');
    }
    if (!Number.isFinite(preco) || preco <= 0) {
      throw new ValidationError('O preço do produto deve ser maior que zero');
    }

    return {
      nome,
      descricao: texto(dados.descricao),
      categoria: texto(dados.categoria) || 'Geral',
      preco: arredondarMoeda(preco),
    };
  }
}
