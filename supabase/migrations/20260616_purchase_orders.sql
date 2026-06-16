-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  po_number text NOT NULL,
  vendor text NOT NULL,
  vendor_email text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','received','cancelled')),
  order_date date NOT NULL,
  expected_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase orders"
  ON purchase_orders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase order items"
  ON purchase_order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id AND po.user_id = auth.uid()
    )
  );
