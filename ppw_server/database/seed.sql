-- Dados iniciais para desenvolvimento. Só roda quando o banco está vazio (sem usuários).
-- Os ids dos usuários são fixos para o front poder "trocar de perfil" sem tela de login.

INSERT INTO usuarios (id, nome, papel) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Ana (Atendente)',   'ATENDENTE'),
  ('00000000-0000-4000-8000-000000000002', 'Carlos (Cozinha)',  'COZINHEIRO'),
  ('00000000-0000-4000-8000-000000000003', 'Edu (Entregador)',  'ENTREGADOR'),
  ('00000000-0000-4000-8000-000000000004', 'Bia (Entregadora)', 'ENTREGADOR'),
  ('00000000-0000-4000-8000-000000000005', 'Gabi (Gerente)',    'GERENTE');

INSERT INTO categorias (nome) VALUES ('Marmitas'), ('Pratos do dia'), ('Bebidas'), ('Sobremesas');

INSERT INTO produtos (id, categoria_id, nome, descricao, preco, tempo_preparo_min, estoque) VALUES
  ('10000000-0000-4000-8000-000000000001', (SELECT id FROM categorias WHERE nome = 'Marmitas'),
     'Marmita Executiva', 'Arroz, feijão, bife acebolado e salada', 24.90, 20, NULL),
  ('10000000-0000-4000-8000-000000000002', (SELECT id FROM categorias WHERE nome = 'Marmitas'),
     'Marmita Fitness', 'Arroz integral, frango grelhado e legumes', 27.50, 18, NULL),
  ('10000000-0000-4000-8000-000000000003', (SELECT id FROM categorias WHERE nome = 'Pratos do dia'),
     'Feijoada Individual', 'Acompanha arroz, couve e farofa', 32.00, 25, NULL),
  ('10000000-0000-4000-8000-000000000004', (SELECT id FROM categorias WHERE nome = 'Bebidas'),
     'Refrigerante Lata', '350 ml', 6.00, 0, 24),
  ('10000000-0000-4000-8000-000000000005', (SELECT id FROM categorias WHERE nome = 'Bebidas'),
     'Suco Natural', '500 ml, sabores do dia', 9.50, 5, NULL),
  ('10000000-0000-4000-8000-000000000006', (SELECT id FROM categorias WHERE nome = 'Sobremesas'),
     'Pudim', 'Fatia de pudim de leite', 8.00, 0, 3);
