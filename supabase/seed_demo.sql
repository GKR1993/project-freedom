-- Seed: lojista demo + 10 produtos
-- Rode DEPOIS de criar o usuário lojista@oferte.com via Authentication → Users

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lojista@oferte.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário lojista@oferte.com não encontrado. Crie via Authentication → Users primeiro.';
  END IF;

  INSERT INTO merchants (id, store_name, owner_name, phone, email, description)
  VALUES (
    v_user_id,
    'Eletrônicos Premium',
    'Carlos Demo',
    '11999887766',
    'lojista@oferte.com',
    'Loja especializada em eletrônicos e eletrodomésticos com estoque selecionado.'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (merchant_id, name, description, category, condition, images, stock_quantity, stock_remaining, min_price, market_price) VALUES

  (v_user_id,
   'Smart TV Samsung 55" 4K QLED',
   'Televisão 55 polegadas com tecnologia QLED, HDR10+, 4 entradas HDMI e Wi-Fi integrado. Ideal para sala de estar.',
   'Eletrônicos', 'new',
   '["https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600"]',
   8, 8, 1800.00, 2499.00),

  (v_user_id,
   'iPhone 14 Pro 256GB Preto',
   'iPhone 14 Pro com chip A16 Bionic, câmera de 48MP, Dynamic Island e tela Super Retina XDR de 6.1". Lacrado.',
   'Eletrônicos', 'new',
   '["https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=600"]',
   5, 5, 4200.00, 5999.00),

  (v_user_id,
   'Notebook Dell Inspiron 15 i5 16GB',
   'Notebook com processador Intel Core i5 de 12ª geração, 16GB RAM, SSD 512GB, tela Full HD 15.6". Windows 11.',
   'Eletrônicos', 'new',
   '["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600"]',
   6, 6, 2800.00, 3799.00),

  (v_user_id,
   'PlayStation 5 + 2 Controles',
   'Console PS5 versão com disco, acompanha 2 controles DualSense. Todos os acessórios originais inclusos.',
   'Eletrônicos', 'like_new',
   '["https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600"]',
   3, 3, 2900.00, 3999.00),

  (v_user_id,
   'Geladeira Brastemp Frost Free 375L',
   'Refrigerador duplex Frost Free com capacidade de 375 litros, tecnologia FastAdapt e painel eletrônico. Inox.',
   'Eletrodomésticos', 'new',
   '["https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600"]',
   4, 4, 2200.00, 3199.00),

  (v_user_id,
   'MacBook Air M2 256GB Prata',
   'MacBook Air com chip Apple M2, 8GB RAM unificada, SSD 256GB, tela Liquid Retina 13.6". Bateria de até 18h.',
   'Eletrônicos', 'new',
   '["https://images.unsplash.com/photo-1611186871525-2e97b10efd7d?w=600"]',
   4, 4, 6500.00, 8999.00),

  (v_user_id,
   'AirPods Pro 2ª Geração',
   'Fone de ouvido Apple com cancelamento de ruído ativo, áudio espacial personalizado e estojo MagSafe. Lacrado.',
   'Eletrônicos', 'new',
   '["https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600"]',
   10, 10, 1100.00, 1599.00),

  (v_user_id,
   'Sofá Retrátil 3 Lugares Veludo',
   'Sofá retrátil e reclinável de 3 lugares em tecido veludo cinza. Estrutura em madeira maciça. 2,10m de largura.',
   'Móveis', 'new',
   '["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600"]',
   5, 5, 1400.00, 1999.00),

  (v_user_id,
   'Bicicleta Elétrica Urbana 350W',
   'Bike elétrica com motor 350W, bateria de 48V/10Ah (autonomia até 50km), freios a disco e câmbio Shimano 7v.',
   'Esportes', 'new',
   '["https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=600"]',
   7, 7, 3200.00, 4499.00),

  (v_user_id,
   'Xbox Series S 512GB',
   'Console Xbox Series S com SSD 512GB, resolução 1440p, 120fps e acesso ao Xbox Game Pass. Cor Robot White.',
   'Eletrônicos', 'like_new',
   '["https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=600"]',
   6, 6, 1600.00, 2199.00);

  RAISE NOTICE 'Seed concluído! Lojista e 10 produtos criados com sucesso.';
END $$;
