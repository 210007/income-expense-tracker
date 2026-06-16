-- Recurring invoice templates
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  next_run_date date NOT NULL,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  auto_send boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_invoice_id uuid NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring invoices"
  ON recurring_invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE recurring_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring invoice items"
  ON recurring_invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM recurring_invoices ri
      WHERE ri.id = recurring_invoice_id AND ri.user_id = auth.uid()
    )
  );
