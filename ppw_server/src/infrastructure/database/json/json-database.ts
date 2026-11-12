import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

// Formato dos registros como ficam gravados no arquivo (datas em texto ISO)
export interface ProdutoRecord {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  preco: number;
  criadoEm: string;
  atualizadoEm?: string;
}

export interface ItemPedidoRecord {
  produtoId: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
  subtotal: number;
}

export interface PedidoRecord {
  id: string;
  numero: number;
  cliente: string;
  telefone: string;
  endereco: string;
  observacao: string;
  itens: ItemPedidoRecord[];
  total: number;
  status: string;
  historico: { status: string; data: string }[];
  criadoEm: string;
  atualizadoEm: string;
}

interface Banco {
  produtos: ProdutoRecord[];
  pedidos: PedidoRecord[];
}

// Enquanto não usamos banco de dados, tudo fica salvo em data/db.json.
// Só os repositórios JSON conhecem esta classe; trocar por um banco de verdade
// significa criar outros repositórios, sem mexer no domínio nem nos casos de uso.
@Injectable()
export class JsonDatabase {
  private readonly arquivo = join(process.cwd(), 'data', 'db.json');

  listar<C extends keyof Banco>(colecao: C): Banco[C] {
    return this.lerArquivo()[colecao] ?? [];
  }

  salvar<C extends keyof Banco>(colecao: C, registros: Banco[C]) {
    const banco = this.lerArquivo();
    banco[colecao] = registros;
    writeFileSync(this.arquivo, JSON.stringify(banco, null, 2), 'utf-8');
  }

  // Lê o arquivo a cada operação, assim alterações feitas à mão no JSON também valem
  private lerArquivo(): Banco {
    if (!existsSync(this.arquivo)) {
      mkdirSync(dirname(this.arquivo), { recursive: true });
      const bancoVazio: Banco = { produtos: [], pedidos: [] };
      writeFileSync(this.arquivo, JSON.stringify(bancoVazio, null, 2), 'utf-8');
      return bancoVazio;
    }

    try {
      return JSON.parse(readFileSync(this.arquivo, 'utf-8')) as Banco;
    } catch {
      throw new Error(`O arquivo ${this.arquivo} não contém um JSON válido`);
    }
  }
}
