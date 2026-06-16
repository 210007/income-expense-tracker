-- Mileage logs for business trip tracking
CREATE TABLE IF NOT EXISTS mileage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_date date NOT NULL,
  miles numeric(8,1) NOT NULL CHECK (miles > 0),
  purpose text NOT NULL,
  from_location text,
  to_location text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mileage logs"
  ON mileage_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
