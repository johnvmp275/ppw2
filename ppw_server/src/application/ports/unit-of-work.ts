import { EstoqueRepository } from '../../domain/repositories/estoque.repository';
import { HistoricoRepository } from '../../domain/repositories/historico.repository';
import { PedidoRepository } from '../../domain/repositories/pedido.repository';
import { ProdutoRepository } from '../../domain/repositories/produto.repository';

// Repositórios que enxergam a MESMA conexão/transação
export interface RepositoriosTransacao {
  pedidos: PedidoRepository;
  produtos: ProdutoRepository;
  estoque: EstoqueRepository;
  historico: HistoricoRepository;
}

// Unidade de trabalho: tudo o que acontece dentro de executar() é gravado junto (COMMIT)
// ou desfeito junto (ROLLBACK) se qualquer passo lançar erro. É o "A" e o "C" do ACID.
export abstract class UnitOfWork {
  abstract executar<T>(trabalho: (repos: RepositoriosTransacao) => Promise<T>): Promise<T>;
}
