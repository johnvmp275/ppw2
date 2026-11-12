import { Module } from '@nestjs/common';
import { PedidoRepository } from '../../domain/repositories/pedido.repository';
import { ProdutoRepository } from '../../domain/repositories/produto.repository';
import { JsonDatabase } from './json/json-database';
import { JsonPedidoRepository } from './json/repositories/json-pedido.repository';
import { JsonProdutoRepository } from './json/repositories/json-produto.repository';

// Liga os contratos do domínio às implementações concretas.
// Para trocar o arquivo JSON por um banco de dados, basta mudar o useClass aqui.
@Module({
  providers: [
    JsonDatabase,
    { provide: ProdutoRepository, useClass: JsonProdutoRepository },
    { provide: PedidoRepository, useClass: JsonPedidoRepository },
  ],
  exports: [ProdutoRepository, PedidoRepository],
})
export class DatabaseModule {}
