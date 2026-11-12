-- =====================================================================
-- Delivery / Cozinha - esquema relacional (PostgreSQL 16+ / PGlite)
-- =====================================================================
-- As regras mais importantes também ficam no banco (CHECK, FK, UNIQUE,
-- trigger), como última linha de defesa caso algum código esqueça de validar.

-- gen_random_uuid() é nativo desde o PostgreSQL 13 (não precisa da extensão pgcrypto)

-- ---------------------------------------------------------------------
-- Usuários e papéis (RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome   TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  papel  TEXT NOT NULL CHECK (papel IN ('ATENDENTE', 'COZINHEIRO', 'ENTREGADOR', 'GERENTE')),
  ativo  BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- Cardápio
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
  id    SERIAL PRIMARY KEY,
  nome  TEXT NOT NULL UNIQUE CHECK (length(trim(nome)) > 0)
);

CREATE TABLE produtos (
  id                 UUID PRIMARY KEY,
  categoria_id       INTEGER NOT NULL REFERENCES categorias (id) ON DELETE RESTRICT,
  nome               TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  descricao          TEXT NOT NULL DEFAULT '',
  preco              NUMERIC(10, 2) NOT NULL CHECK (preco > 0),
  tempo_preparo_min  INTEGER NOT NULL DEFAULT 0 CHECK (tempo_preparo_min BETWEEN 0 AND 240),
  -- NULL = feito na hora (não controla estoque). Nunca negativo: é o CHECK que
  -- impede vender a última lata duas vezes, mesmo se o código falhar.
  estoque            INTEGER NULL CHECK (estoque IS NULL OR estoque >= 0),
  ativo              BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX produtos_categoria_idx ON produtos (categoria_id);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
-- SEQUENCE no lugar de "SELECT max(numero) + 1": duas vendas no mesmo instante
-- nunca recebem o mesmo número.
CREATE SEQUENCE pedidos_numero_seq;

CREATE TABLE pedidos (
  id                UUID PRIMARY KEY,
  numero            INTEGER NOT NULL UNIQUE DEFAULT nextval('pedidos_numero_seq'),
  cliente           TEXT NOT NULL CHECK (length(trim(cliente)) > 0),
  telefone          TEXT NOT NULL DEFAULT '',
  endereco          TEXT NOT NULL CHECK (length(trim(endereco)) > 0),
  observacao        TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'RECEBIDO' CHECK (
                      status IN ('RECEBIDO', 'EM_PREPARO', 'PRONTO_PARA_RETIRADA',
                                 'EM_ROTA_DE_ENTREGA', 'ENTREGUE', 'CANCELADO')),
  -- Bloqueio otimista
  versao            INTEGER NOT NULL DEFAULT 1 CHECK (versao >= 1),
  criado_por_id     UUID NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  entregador_id     UUID NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  prazo_preparo_em  TIMESTAMPTZ NULL,
  valor_perda       NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (valor_perda >= 0),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Coerência entre colunas
  CONSTRAINT pedido_em_rota_tem_entregador
    CHECK (status NOT IN ('EM_ROTA_DE_ENTREGA', 'ENTREGUE') OR entregador_id IS NOT NULL),
  CONSTRAINT pedido_em_preparo_tem_prazo
    CHECK (status = 'RECEBIDO' OR status = 'CANCELADO' OR prazo_preparo_em IS NOT NULL)
);

CREATE INDEX pedidos_status_idx ON pedidos (status);
-- Acelera a guarda "limite de entregas simultâneas por entregador"
CREATE INDEX pedidos_entregador_em_rota_idx ON pedidos (entregador_id) WHERE status = 'EM_ROTA_DE_ENTREGA';

-- Nome, preço e tempo de preparo são copiados do produto no momento da venda
-- (histórico de preço). A chave primária composta impede o mesmo produto duas vezes no pedido.
CREATE TABLE itens_pedido (
  pedido_id          UUID NOT NULL REFERENCES pedidos (id) ON DELETE RESTRICT,
  produto_id         UUID NOT NULL REFERENCES produtos (id) ON DELETE RESTRICT,
  nome_produto       TEXT NOT NULL,
  preco_unitario     NUMERIC(10, 2) NOT NULL CHECK (preco_unitario > 0),
  quantidade         INTEGER NOT NULL CHECK (quantidade > 0),
  tempo_preparo_min  INTEGER NOT NULL DEFAULT 0 CHECK (tempo_preparo_min >= 0),
  reserva_estoque    BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (pedido_id, produto_id)
);

CREATE INDEX itens_pedido_produto_idx ON itens_pedido (produto_id);

-- ---------------------------------------------------------------------
-- Trilha de auditoria (append-only)
-- ---------------------------------------------------------------------
CREATE TABLE pedido_historico (
  id               BIGSERIAL PRIMARY KEY,
  pedido_id        UUID NOT NULL REFERENCES pedidos (id) ON DELETE RESTRICT,
  acao             TEXT NOT NULL,
  estado_anterior  TEXT NULL,
  novo_estado      TEXT NOT NULL,
  autor_id         UUID NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  justificativa    TEXT NULL,
  detalhes         JSONB NULL,
  -- clock_timestamp() e não now(): dentro de uma transação now() é sempre o mesmo instante
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT historico_criacao_sem_estado_anterior
    CHECK ((acao = 'CRIAR') = (estado_anterior IS NULL))
);

CREATE INDEX pedido_historico_pedido_idx ON pedido_historico (pedido_id, id);

CREATE FUNCTION bloquear_alteracao_historico() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'A trilha de auditoria é somente inserção: % não é permitido em pedido_historico', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pedido_historico_imutavel
  BEFORE UPDATE OR DELETE ON pedido_historico
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_historico();

-- ---------------------------------------------------------------------
-- Movimentações de estoque (auditoria do estoque)
-- ---------------------------------------------------------------------
CREATE TABLE movimentacoes_estoque (
  id          BIGSERIAL PRIMARY KEY,
  produto_id  UUID NOT NULL REFERENCES produtos (id) ON DELETE RESTRICT,
  pedido_id   UUID NULL REFERENCES pedidos (id) ON DELETE RESTRICT,
  tipo        TEXT NOT NULL CHECK (tipo IN ('RESERVA', 'DEVOLUCAO', 'AJUSTE')),
  -- negativo = saiu do estoque, positivo = entrou
  quantidade  INTEGER NOT NULL CHECK (quantidade <> 0),
  saldo_apos  INTEGER NOT NULL CHECK (saldo_apos >= 0),
  autor_id    UUID NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  motivo      TEXT NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX movimentacoes_produto_idx ON movimentacoes_estoque (produto_id, id);

CREATE TRIGGER movimentacoes_estoque_imutavel
  BEFORE UPDATE OR DELETE ON movimentacoes_estoque
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_historico();
