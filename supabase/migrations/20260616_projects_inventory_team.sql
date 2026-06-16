-- projects
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  budget numeric,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);
alter table projects enable row level security;
create policy "users manage own projects" on projects for all using (auth.uid() = user_id);

-- link transactions to projects (optional)
alter table transactions add column if not exists project_id uuid references projects(id) on delete set null;

-- products / inventory
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sku text,
  description text,
  unit_price numeric not null default 0,
  cost_price numeric not null default 0,
  stock_quantity numeric not null default 0,
  low_stock_threshold numeric not null default 5,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table products enable row level security;
create policy "users manage own products" on products for all using (auth.uid() = user_id);

-- inventory_adjustments: log every stock change
create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  adjustment numeric not null,   -- positive = stock in, negative = stock out
  reason text,
  created_at timestamptz not null default now()
);
alter table inventory_adjustments enable row level security;
create policy "users manage own adjustments" on inventory_adjustments for all using (auth.uid() = user_id);

-- team_members: invite other users to access your account
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_email text not null,
  member_user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'active', 'removed')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(owner_user_id, member_email)
);
alter table team_members enable row level security;
create policy "owners manage their team" on team_members for all using (auth.uid() = owner_user_id);
create policy "members see their invites" on team_members for select using (auth.uid() = member_user_id);

-- RLS helper: allows team members (admin/member) to read the owner's data
-- Apply this to each table by adding: OR auth.uid() IN (SELECT member_user_id FROM team_members WHERE owner_user_id = user_id AND status = 'active' AND role IN ('admin','member'))
-- See supabase/migrations/20260616_team_rls.sql for the full update
