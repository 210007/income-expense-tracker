-- user_modules: tracks which Stripe-billed modules each user has active
create table if not exists user_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,                        -- e.g. 'invoicing', 'recurring', 'scheduling'
  stripe_subscription_id text,
  stripe_customer_id text,
  status text not null default 'active',       -- active | canceled | past_due
  created_at timestamptz not null default now(),
  unique(user_id, module)
);
alter table user_modules enable row level security;
create policy "users see own modules" on user_modules for select using (auth.uid() = user_id);

-- invoices
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft',        -- draft | sent | paid | void
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table invoices enable row level security;
create policy "users manage own invoices" on invoices for all using (auth.uid() = user_id);

-- invoice_items: line items on an invoice
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0
);
alter table invoice_items enable row level security;
create policy "users manage own invoice items" on invoice_items
  for all using (
    exists (
      select 1 from invoices where invoices.id = invoice_items.invoice_id
        and invoices.user_id = auth.uid()
    )
  );
