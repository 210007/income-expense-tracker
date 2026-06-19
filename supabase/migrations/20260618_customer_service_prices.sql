CREATE TABLE IF NOT EXISTS customer_service_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  service_name text not null,
  price numeric(10,2) not null,
  created_at timestamptz default now()
);

ALTER TABLE customer_service_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own customer service prices" ON customer_service_prices;
CREATE POLICY "users manage own customer service prices" ON customer_service_prices
  FOR ALL USING (auth.uid() = user_id);
