import { Pedido } from '../../../domain/entities/pedido.entity';
import { ConflitoError, ValidationError } from '../../../domain/errors/domain.error';

// Toda escrita em um pedido precisa dizer qual versão o usuário estava vendo.
export function lerVersao(valor: unknown): number {
  const versao = Number(valor);
  if (!Number.isInteger(versao) || versao < 1) {
    throw new ValidationError('Informe a versão do pedido que você está vendo (campo "versao")');
  }
  return versao;
}

// Se a versão mudou, alguém gravou no meio do caminho: a decisão do usuário foi tomada
// em cima de dados velhos, então recusamos (409) em vez de sobrescrever.
export function garantirVersao(pedido: Pedido, versaoInformada: number) {
  if (pedido.versao !== versaoInformada) {
    throw new ConflitoError(
      `O pedido #${pedido.numero} foi alterado por outra pessoa enquanto você o via ` +
        `(versão ${versaoInformada} -> ${pedido.versao}, agora ${pedido.status}). Recarregue e tente de novo`,
    );
  }
}
