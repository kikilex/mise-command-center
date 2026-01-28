-- Migration: Create products and sales tables for multi-business architecture
-- Date: 2026-01-28
-- Description: Adds products and sales tracking tables with business_id foreign keys

-- =============================================================================
-- PRODUCTS TABLE
-- =============================================================================
-- Stores products for each business
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  sku TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for products
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view products for businesses they belong to
CREATE POLICY "Users can view business products" ON products
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- Policy: Users can insert products for businesses they manage
CREATE POLICY "Users can insert products" ON products
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- Policy: Users can update products for businesses they manage
CREATE POLICY "Users can update products" ON products
  FOR UPDATE USING (
    business_id IN (
      SELECT business_id FROM business_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- Policy: Users can delete products for businesses they own
CREATE POLICY "Users can delete products" ON products
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- =============================================================================
-- SALES TABLE
-- =============================================================================
-- Tracks all sales/revenue for each business
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  quantity INTEGER DEFAULT 1,
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'manual', -- 'manual', 'shopify', 'amazon', 'tiktok', etc.
  metadata JSONB DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sales
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_source ON sales(source);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by);

-- Composite index for common query pattern (business + date range)
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business_id, sale_date DESC);

-- Enable RLS on sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view sales for businesses they belong to
CREATE POLICY "Users can view business sales" ON sales
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- Policy: Users can insert sales for businesses they belong to
CREATE POLICY "Users can insert sales" ON sales
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- Policy: Users can update their own sales entries
CREATE POLICY "Users can update own sales" ON sales
  FOR UPDATE USING (
    created_by = auth.uid()
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- Policy: Business owners can delete sales
CREATE POLICY "Owners can delete sales" ON sales
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- HELPER VIEWS (Optional - for easier querying)
-- =============================================================================

-- View for daily sales aggregation per business
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT 
  business_id,
  DATE(sale_date) as sale_day,
  COUNT(*) as total_transactions,
  SUM(amount) as total_revenue,
  SUM(quantity) as total_units,
  source
FROM sales
GROUP BY business_id, DATE(sale_date), source;

-- View for product performance
CREATE OR REPLACE VIEW product_performance AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.business_id,
  p.price as unit_price,
  COALESCE(SUM(s.amount), 0) as total_revenue,
  COALESCE(SUM(s.quantity), 0) as total_units_sold,
  COUNT(s.id) as total_transactions
FROM products p
LEFT JOIN sales s ON s.product_id = p.id
WHERE p.is_active = TRUE
GROUP BY p.id, p.name, p.business_id, p.price;

-- =============================================================================
-- SAMPLE DATA (Comment out in production)
-- =============================================================================
-- Uncomment to insert sample data for testing
/*
-- Get a business ID first
WITH first_business AS (
  SELECT id FROM businesses LIMIT 1
)
INSERT INTO products (name, description, price, business_id, sku, is_active)
SELECT 
  'Spiritual Warfare Prayer Guide',
  'Digital download with powerful prayers',
  9.99,
  id,
  'SWP-001',
  true
FROM first_business;

INSERT INTO products (name, description, price, business_id, sku, is_active)
SELECT 
  'Testimony Collection Vol 1',
  'Collection of powerful testimonies',
  14.99,
  id,
  'TC-001',
  true
FROM first_business;
*/
