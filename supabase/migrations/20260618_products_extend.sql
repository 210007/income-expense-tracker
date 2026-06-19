-- Extend products table to serve as a general Products & Services catalog
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS type text default 'product' check (type in ('product', 'service')),
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS is_active boolean default true;
