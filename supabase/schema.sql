-- Oferte e Compre — Schema SQL
-- Execute no SQL Editor do Supabase

-- ============================================================
-- MERCHANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS merchants (
  id uuid REFERENCES auth.users PRIMARY KEY,
  store_name text NOT NULL,
  owner_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  logo_url text,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchants_select_own" ON merchants;
DROP POLICY IF EXISTS "merchants_insert_own" ON merchants;
DROP POLICY IF EXISTS "merchants_update_own" ON merchants;

CREATE POLICY "merchants_select_own" ON merchants
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "merchants_insert_own" ON merchants
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "merchants_update_own" ON merchants
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  condition text NOT NULL DEFAULT 'new' CHECK (condition IN ('new', 'like_new', 'good', 'fair')),
  images jsonb NOT NULL DEFAULT '[]',
  stock_quantity integer NOT NULL CHECK (stock_quantity > 0),
  stock_remaining integer NOT NULL CHECK (stock_remaining >= 0),
  min_price numeric NOT NULL CHECK (min_price > 0),        -- hidden from customers
  market_price numeric NOT NULL CHECK (market_price > 0),  -- shown to customers
  accepted_offers_sum numeric NOT NULL DEFAULT 0,
  accepted_offers_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'sold_out', 'deleted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_merchant_all" ON products;
DROP POLICY IF EXISTS "products_public_read" ON products;

CREATE POLICY "products_merchant_all" ON products
  FOR ALL TO authenticated USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "products_public_read" ON products
  FOR SELECT TO anon, authenticated USING (status IN ('active', 'sold_out'));

-- ============================================================
-- OFFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS offers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offers_merchant_read" ON offers;
DROP POLICY IF EXISTS "offers_public_insert" ON offers;

CREATE POLICY "offers_merchant_read" ON offers
  FOR SELECT TO authenticated
  USING (
    product_id IN (SELECT id FROM products WHERE merchant_id = auth.uid())
  );

CREATE POLICY "offers_public_insert" ON offers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- STORAGE: product images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "product_images_merchant_upload" ON storage.objects;
DROP POLICY IF EXISTS "product_images_merchant_delete" ON storage.objects;

CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'product-images');

CREATE POLICY "product_images_merchant_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "product_images_merchant_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');

-- ============================================================
-- CORE FUNCTION: make_offer (atomic, prevents race conditions)
-- ============================================================
CREATE OR REPLACE FUNCTION make_offer(
  p_product_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_new_sum numeric;
  v_new_count integer;
  v_new_average numeric;
  v_offer_id uuid;
  v_merchant merchants%ROWTYPE;
BEGIN
  -- Lock the product row to prevent concurrent race conditions
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found',
      'message', 'Produto não encontrado.');
  END IF;

  IF v_product.status = 'deleted' OR v_product.status = 'paused' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unavailable',
      'message', 'Este produto não está disponível no momento.');
  END IF;

  IF v_product.status = 'sold_out' OR v_product.stock_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'sold_out',
      'message', 'Produto esgotado. Não há mais unidades disponíveis.');
  END IF;

  -- Calculate new average including this offer
  v_new_sum   := v_product.accepted_offers_sum + p_amount;
  v_new_count := v_product.accepted_offers_count + 1;
  v_new_average := v_new_sum / v_new_count;

  -- Accept if new average stays strictly above the merchant's minimum price
  IF v_new_average > v_product.min_price THEN
    INSERT INTO offers (product_id, customer_name, customer_phone, customer_email, amount, status)
    VALUES (p_product_id, p_customer_name, p_customer_phone, p_customer_email, p_amount, 'accepted')
    RETURNING id INTO v_offer_id;

    UPDATE products SET
      accepted_offers_sum   = v_new_sum,
      accepted_offers_count = v_new_count,
      stock_remaining = stock_remaining - 1,
      status = CASE WHEN stock_remaining - 1 <= 0 THEN 'sold_out' ELSE 'active' END,
      updated_at = now()
    WHERE id = p_product_id;

    -- Fetch merchant contact for the confirmation message
    SELECT * INTO v_merchant FROM merchants WHERE id = v_product.merchant_id;

    RETURN jsonb_build_object(
      'success', true,
      'offer_id', v_offer_id,
      'amount', p_amount,
      'merchant_phone', v_merchant.phone,
      'merchant_name', v_merchant.store_name,
      'message', 'Parabéns! Sua oferta foi aceita!'
    );
  ELSE
    INSERT INTO offers (product_id, customer_name, customer_phone, customer_email, amount, status)
    VALUES (p_product_id, p_customer_name, p_customer_phone, p_customer_email, p_amount, 'rejected')
    RETURNING id INTO v_offer_id;

    RETURN jsonb_build_object(
      'success', false,
      'offer_id', v_offer_id,
      'reason', 'below_minimum',
      'message', 'Sua oferta ficou abaixo do valor mínimo aceito. Tente um valor maior!'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION make_offer TO anon, authenticated;

-- ============================================================
-- HELPER VIEW: public products (hides min_price)
-- ============================================================
CREATE OR REPLACE VIEW public_products AS
  SELECT
    p.id,
    p.name,
    p.description,
    p.category,
    p.condition,
    p.images,
    p.stock_remaining,
    p.market_price,
    p.accepted_offers_count,
    p.status,
    p.created_at,
    m.store_name,
    m.logo_url
  FROM products p
  JOIN merchants m ON m.id = p.merchant_id
  WHERE p.status IN ('active', 'sold_out');

GRANT SELECT ON public_products TO anon, authenticated;
