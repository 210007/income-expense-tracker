-- recurring_transactions: template rows that auto-generate real transactions on a schedule
create table if not exists recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null,
  vendor text not null,
  description text,
  category text,
  frequency text not null check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  start_date date not null default current_date,
  next_run_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table recurring_transactions enable row level security;
create policy "users manage own recurring" on recurring_transactions for all using (auth.uid() = user_id);

-- appointments
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  title text not null,
  notes text,
  start_time timestamptz not null,
  end_time timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table appointments enable row level security;
create policy "users manage own appointments" on appointments for all using (auth.uid() = user_id);
