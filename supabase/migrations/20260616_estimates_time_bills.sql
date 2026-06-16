-- estimates / quotes
create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  estimate_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'converted')),
  issue_date date not null default current_date,
  expiry_date date,
  notes text,
  invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table estimates enable row level security;
create policy "users manage own estimates" on estimates for all using (auth.uid() = user_id);

-- estimate_items
create table if not exists estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0
);
alter table estimate_items enable row level security;
create policy "users manage own estimate items" on estimate_items
  for all using (
    exists (
      select 1 from estimates where estimates.id = estimate_items.estimate_id
        and estimates.user_id = auth.uid()
    )
  );

-- time_entries: billable hours tracking
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  description text not null,
  hours numeric not null,
  rate numeric not null default 0,
  entry_date date not null default current_date,
  invoiced boolean not null default false,
  invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table time_entries enable row level security;
create policy "users manage own time entries" on time_entries for all using (auth.uid() = user_id);

-- bills: accounts payable (what you owe vendors)
create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor text not null,
  amount numeric not null,
  due_date date,
  status text not null default 'due' check (status in ('due', 'paid', 'void')),
  description text,
  category text,
  paid_date date,
  created_at timestamptz not null default now()
);
alter table bills enable row level security;
create policy "users manage own bills" on bills for all using (auth.uid() = user_id);
