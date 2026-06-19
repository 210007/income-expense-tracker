CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  dashboard_config jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own preferences" ON user_preferences;
CREATE POLICY "users manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);
