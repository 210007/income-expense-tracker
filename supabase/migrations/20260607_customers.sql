-- ============================================================
-- Migration: Customer Database
-- Created: 2026-06-07
-- Apply in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Customers table
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now()
);

alter table public.customers enable row level security;

create policy "Users can manage their own customers"
  on public.customers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Custom field definitions (per user)
create table if not exists public.customer_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  field_type text not null default 'text', -- text, number, date, boolean
  created_at timestamptz default now()
);

alter table public.customer_fields enable row level security;

create policy "Users can manage their own customer fields"
  on public.customer_fields
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Custom field values per customer
create table if not exists public.customer_field_values (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  field_id uuid not null references public.customer_fields(id) on delete cascade,
  value text,
  unique(customer_id, field_id)
);

alter table public.customer_field_values enable row level security;

create policy "Users can manage their own customer field values"
  on public.customer_field_values
  for all
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_id and c.user_id = auth.uid()
    )
  );
