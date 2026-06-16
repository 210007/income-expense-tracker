-- OPTIONAL: Run this migration AFTER 20260616_projects_inventory_team.sql
-- to enable team members to read/write the owner's data.
-- This replaces the RLS policies on all main tables with ones that also
-- allow active team members access.

-- Helper function
create or replace function is_team_member_of(owner_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from team_members
    where owner_user_id = owner_id
      and member_user_id = auth.uid()
      and status = 'active'
      and role in ('admin', 'member')
  );
$$;

-- transactions
drop policy if exists "Users can only see their own transactions" on transactions;
create policy "users or team members access transactions" on transactions
  for all using (auth.uid() = user_id or is_team_member_of(user_id));

-- customers
drop policy if exists "Users can manage their own customers" on customers;
create policy "users or team members access customers" on customers
  for all using (auth.uid() = user_id or is_team_member_of(user_id));

-- invoices
drop policy if exists "users manage own invoices" on invoices;
create policy "users or team members access invoices" on invoices
  for all using (auth.uid() = user_id or is_team_member_of(user_id));

-- invoice_items (inherits through invoices join)
drop policy if exists "users manage own invoice items" on invoice_items;
create policy "users or team members access invoice items" on invoice_items
  for all using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_items.invoice_id
        and (invoices.user_id = auth.uid() or is_team_member_of(invoices.user_id))
    )
  );

-- estimates
drop policy if exists "users manage own estimates" on estimates;
create policy "users or team members access estimates" on estimates
  for all using (auth.uid() = user_id or is_team_member_of(user_id));

-- time_entries
drop policy if exists "users manage own time entries" on time_entries;
create policy "users or team members access time entries" on time_entries
  for all using (auth.uid() = user_id or is_team_member_of(user_id));

-- bills
drop policy if exists "users manage own bills" on bills;
create policy "users or team members access bills" on bills
  for all using (auth.uid() = user_id or is_team_member_of(user_id));

-- projects
drop policy if exists "users manage own projects" on projects;
create policy "users or team members access projects" on projects
  for all using (auth.uid() = user_id or is_team_member_of(user_id));

-- products
drop policy if exists "users manage own products" on products;
create policy "users or team members access products" on products
  for all using (auth.uid() = user_id or is_team_member_of(user_id));

-- recurring_transactions
drop policy if exists "users manage own recurring" on recurring_transactions;
create policy "users or team members access recurring" on recurring_transactions
  for all using (auth.uid() = user_id or is_team_member_of(user_id));

-- appointments
drop policy if exists "users manage own appointments" on appointments;
create policy "users or team members access appointments" on appointments
  for all using (auth.uid() = user_id or is_team_member_of(user_id));
