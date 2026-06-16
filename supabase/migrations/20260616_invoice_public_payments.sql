-- Add public payment token and paid_at timestamp to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS public_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Backfill any existing rows that might have null tokens
UPDATE invoices SET public_token = gen_random_uuid() WHERE public_token IS NULL;

-- Unique index for fast lookup by token
CREATE UNIQUE INDEX IF NOT EXISTS invoices_public_token_idx ON invoices(public_token);
