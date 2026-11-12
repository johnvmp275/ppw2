import { PermissaoNegadaError } from '../errors/domain.error';

// Papéis da operação. Cada ação da máquina de estados declara quais papéis podem executá-la (RBAC).
export const PAPEIS = ['ATENDENTE', 'COZINHEIRO', 'ENTREGADOR', 'GERENTE'] as const;
export type Papel = (typeof PAPEIS)[number];

export interface UsuarioProps {
  nome: string;
  papel: Papel;
  ativo: boolean;
}

export class Usuario {
  private constructor(
    readonly id: string,
    private readonly props: UsuarioProps,
  ) {}

  static restaurar(id: string, props: UsuarioProps): Usuario {
    return new Usuario(id, { ...props });
  }

  get nome() {
    return this.props.nome;
  }

  get papel() {
    return this.props.papel;
  }

  get ativo() {
    return this.props.ativo;
  }

  temPapel(...papeis: readonly Papel[]): boolean {
    return papeis.includes(this.props.papel);
  }

  // Atalho para regras fora da máquina de estados (cadastro de produtos, criação de pedidos...)
  exigirPapel(papeis: readonly Papel[], oQue: string) {
    if (!this.temPapel(...papeis)) {
      throw new PermissaoNegadaError(`O perfil ${this.papel} não pode ${oQue}. Permitido para: ${papeis.join(', ')}`);
    }
  }
}
