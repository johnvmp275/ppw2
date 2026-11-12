import { Pedido } from '../entities/pedido.entity';
import { Papel, Usuario } from '../entities/usuario.entity';
import {
  GuardaTransicaoError,
  PermissaoNegadaError,
  TransicaoInvalidaError,
  ValidationError,
} from '../errors/domain.error';
import { ItemPedido } from '../value-objects/item-pedido';
import { StatusPedido } from '../value-objects/status-pedido';
import { AcaoPedido, ConsultasTransicao, ContextoTransicao } from './acao-pedido';
import { LIMITE_ENTREGAS_SIMULTANEAS } from './acoes/despachar.acao';
import { MaquinaEstadosPedido, criarMaquinaEstadosPedido } from './maquina-estados-pedido';

const usuario = (papel: Papel, id = `id-${papel}`) => Usuario.restaurar(id, { nome: papel, papel, ativo: true });

const marmita = ItemPedido.criar({
  produtoId: 'marmita',
  nome: 'Marmita',
  precoUnitario: 25,
  quantidade: 2,
  tempoPreparoMin: 20,
  reservaEstoque: false,
});
const refri = ItemPedido.criar({
  produtoId: 'refri',
  nome: 'Refri',
  precoUnitario: 6,
  quantidade: 1,
  tempoPreparoMin: 0,
  reservaEstoque: true,
});

function pedido(status: StatusPedido, extra: Partial<Parameters<typeof Pedido.restaurar>[1]> = {}) {
  return Pedido.restaurar('p1', {
    numero: 7,
    cliente: 'Maria',
    telefone: '',
    endereco: 'Rua A',
    observacao: '',
    itens: [marmita, refri],
    status,
    versao: 1,
    criadoPorId: 'id-ATENDENTE',
    entregadorId: null,
    prazoPreparoEm: status === 'RECEBIDO' ? null : new Date('2026-11-12T12:20:00Z'),
    valorPerda: 0,
    criadoEm: new Date('2026-11-12T12:00:00Z'),
    atualizadoEm: new Date('2026-11-12T12:00:00Z'),
    ...extra,
  });
}

const semEntregas: ConsultasTransicao = { contarEntregasEmRota: async () => 0 };
const agora = new Date('2026-11-12T12:10:00Z');

function ctx(p: Pedido, u: Usuario, justificativa = '', consultas = semEntregas): ContextoTransicao {
  return { pedido: p, usuario: u, justificativa, agora, consultas };
}

describe('Máquina de estados do pedido', () => {
  let maquina: MaquinaEstadosPedido;

  beforeEach(() => {
    maquina = criarMaquinaEstadosPedido();
  });

  it('percorre o fluxo feliz até ENTREGUE', async () => {
    const p = pedido('RECEBIDO');
    const cozinheiro = usuario('COZINHEIRO');
    const entregador = usuario('ENTREGADOR');

    await maquina.executar('INICIAR_PREPARO', ctx(p, cozinheiro));
    expect(p.status).toBe('EM_PREPARO');
    // SLA = maior tempo de preparo entre os itens (20 min)
    expect(p.prazoPreparoEm).toEqual(new Date('2026-11-12T12:30:00Z'));

    await maquina.executar('marcar-pronto', ctx(p, cozinheiro));
    await maquina.executar('DESPACHAR', ctx(p, entregador));
    expect(p.entregadorId).toBe(entregador.id);
    await maquina.executar('CONFIRMAR_ENTREGA', ctx(p, entregador));
    expect(p.status).toBe('ENTREGUE');
  });

  it('recusa ação que não sai do estado atual (422) e ação desconhecida (400)', async () => {
    await expect(maquina.executar('DESPACHAR', ctx(pedido('RECEBIDO'), usuario('ENTREGADOR')))).rejects.toThrow(
      TransicaoInvalidaError,
    );
    await expect(maquina.executar('CONFIRMAR_ENTREGA', ctx(pedido('ENTREGUE'), usuario('GERENTE')))).rejects.toThrow(
      TransicaoInvalidaError,
    );
    await expect(maquina.executar('VOAR', ctx(pedido('RECEBIDO'), usuario('GERENTE')))).rejects.toThrow(ValidationError);
  });

  it('aplica a matriz de permissões por estado (403)', async () => {
    await expect(maquina.executar('INICIAR_PREPARO', ctx(pedido('RECEBIDO'), usuario('ATENDENTE')))).rejects.toThrow(
      PermissaoNegadaError,
    );
    // Atendente cancela antes da produção, mas não depois que a cozinha começou
    await expect(
      maquina.executar('CANCELAR', ctx(pedido('RECEBIDO'), usuario('ATENDENTE'), 'Cliente desistiu')),
    ).resolves.toBeDefined();
    await expect(
      maquina.executar('CANCELAR', ctx(pedido('EM_PREPARO'), usuario('ATENDENTE'), 'Cliente desistiu')),
    ).rejects.toThrow(PermissaoNegadaError);
    // Só o entregador do próprio pedido confirma a entrega
    const emRota = pedido('EM_ROTA_DE_ENTREGA', { entregadorId: 'outro-entregador' });
    await expect(maquina.executar('CONFIRMAR_ENTREGA', ctx(emRota, usuario('ENTREGADOR')))).rejects.toThrow(
      PermissaoNegadaError,
    );
  });

  it('exige justificativa para cancelar e para devolver ao preparo', async () => {
    await expect(maquina.executar('CANCELAR', ctx(pedido('RECEBIDO'), usuario('GERENTE'), 'curta'))).rejects.toThrow(
      GuardaTransicaoError,
    );
    await expect(
      maquina.executar('DEVOLVER_AO_PREPARO', ctx(pedido('PRONTO_PARA_RETIRADA'), usuario('COZINHEIRO'))),
    ).rejects.toThrow(GuardaTransicaoError);
  });

  it('exige justificativa para marcar pronto quando o SLA estourou', async () => {
    const atrasado = pedido('EM_PREPARO', { prazoPreparoEm: new Date('2026-11-12T12:05:00Z') });
    await expect(maquina.executar('MARCAR_PRONTO', ctx(atrasado, usuario('COZINHEIRO')))).rejects.toThrow(
      GuardaTransicaoError,
    );
    const resultado = await maquina.executar(
      'MARCAR_PRONTO',
      ctx(atrasado, usuario('COZINHEIRO'), 'Fogão com defeito'),
    );
    expect(resultado.detalhes).toMatchObject({ atrasado: true, minutosDeAtraso: 5 });
  });

  it('limita as entregas simultâneas por entregador (validação cruzada)', async () => {
    const lotado: ConsultasTransicao = { contarEntregasEmRota: async () => LIMITE_ENTREGAS_SIMULTANEAS };
    await expect(
      maquina.executar('DESPACHAR', ctx(pedido('PRONTO_PARA_RETIRADA'), usuario('ENTREGADOR'), '', lotado)),
    ).rejects.toThrow(GuardaTransicaoError);
  });

  describe('rollback do cancelamento', () => {
    const gerente = usuario('GERENTE');
    const motivo = 'Cliente desistiu do pedido';

    it('antes do preparo devolve tudo que baixou estoque e não gera perda', async () => {
      const p = pedido('RECEBIDO');
      const r = await maquina.executar('CANCELAR', ctx(p, gerente, motivo));
      expect(r.devolucoesEstoque).toEqual([{ produtoId: 'refri', nome: 'Refri', quantidade: 1 }]);
      expect(p.valorPerda).toBe(0);
    });

    it('durante o preparo devolve só o lacrado e lança os pratos como perda', async () => {
      const p = pedido('EM_PREPARO');
      const r = await maquina.executar('CANCELAR', ctx(p, gerente, motivo));
      expect(r.devolucoesEstoque).toHaveLength(1);
      expect(p.valorPerda).toBe(50);
      expect(p.status).toBe('CANCELADO');
    });

    it('em rota não devolve nada e o pedido inteiro vira perda', async () => {
      const p = pedido('EM_ROTA_DE_ENTREGA', { entregadorId: 'e1' });
      const r = await maquina.executar('CANCELAR', ctx(p, gerente, motivo));
      expect(r.devolucoesEstoque).toHaveLength(0);
      expect(p.valorPerda).toBe(56);
    });
  });

  it('lista só as ações que o perfil pode executar no estado atual', () => {
    const nomes = (status: StatusPedido, papel: Papel) =>
      maquina.acoesDisponiveis(pedido(status), usuario(papel)).map((a) => a.nome);

    expect(nomes('RECEBIDO', 'COZINHEIRO')).toEqual(['INICIAR_PREPARO']);
    expect(nomes('RECEBIDO', 'ATENDENTE')).toEqual(['CANCELAR']);
    expect(nomes('EM_PREPARO', 'GERENTE')).toEqual(['MARCAR_PRONTO', 'CANCELAR']);
    expect(nomes('ENTREGUE', 'GERENTE')).toEqual([]);
  });

  it('é aberta para extensão: uma ação nova entra sem mudar a máquina (OCP)', async () => {
    class ReabrirAcao extends AcaoPedido {
      readonly nome = 'REABRIR';
      readonly rotulo = 'Reabrir';
      readonly origens = ['CANCELADO'] as const;
      readonly destino = 'RECEBIDO' as const;
      protected readonly papeis = ['GERENTE'] as const;
    }
    const estendida = new MaquinaEstadosPedido([new ReabrirAcao()]);
    const p = pedido('CANCELADO');
    await estendida.executar('REABRIR', ctx(p, usuario('GERENTE')));
    expect(p.status).toBe('RECEBIDO');
  });
});
