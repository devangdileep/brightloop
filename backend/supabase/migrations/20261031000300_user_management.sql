-- Brightloop Software — User Management & Role-Based Workflows Migration
-- Supports Admin, Staff, and Customer roles with dedicated dashboards and RLS.

-- ---------------------------------------------------------------------------
-- 1. Extend profiles table
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists status text not null default 'active' check (status in ('active', 'inactive', 'suspended'));

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);

-- ---------------------------------------------------------------------------
-- 2. Staff Details table
-- ---------------------------------------------------------------------------
create table if not exists public.staff_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  department text,
  designation text,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_details_user_id_idx on public.staff_details (user_id);

create trigger staff_details_updated_at
  before update on public.staff_details
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Extend customers table (backward compatible aliases)
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists company_name text,
  add column if not exists billing_address text,
  add column if not exists customer_status text default 'active' check (customer_status in ('active', 'inactive'));

-- Backfill from existing columns
update public.customers
set
  company_name = coalesce(company_name, company),
  billing_address = coalesce(billing_address, address),
  customer_status = coalesce(customer_status, status)
where company_name is null or billing_address is null or customer_status is null;

-- Sync trigger between legacy and updated column names
create or replace function public.sync_customer_fields()
returns trigger
language plpgsql
as $$
begin
  if new.company is distinct from old.company and (new.company_name is null or new.company_name = old.company_name) then
    new.company_name := new.company;
  elsif new.company_name is distinct from old.company_name and (new.company is null or new.company = old.company) then
    new.company := new.company_name;
  end if;

  if new.address is distinct from old.address and (new.billing_address is null or new.billing_address = old.billing_address) then
    new.billing_address := new.address;
  elsif new.billing_address is distinct from old.billing_address and (new.address is null or new.address = old.address) then
    new.address := new.billing_address;
  end if;

  if new.status is distinct from old.status and (new.customer_status is null or new.customer_status = old.customer_status) then
    new.customer_status := new.status;
  elsif new.customer_status is distinct from old.customer_status and (new.status is null or new.status = old.status) then
    new.status := new.customer_status;
  end if;

  return new;
end;
$$;

drop trigger if exists customers_sync_fields on public.customers;
create trigger customers_sync_fields
  before insert or update on public.customers
  for each row execute function public.sync_customer_fields();

-- ---------------------------------------------------------------------------
-- 4. Activity Logs (Audit Trail)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_user_id_idx on public.activity_logs (user_id);
create index if not exists activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);
create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Updated handle_new_user() trigger function
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone text;
  v_existing_customer_id uuid;
begin
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1));
  v_phone := new.raw_user_meta_data ->> 'phone';

  -- Create customer profile (always default role = customer for public auth)
  insert into public.profiles (id, email, full_name, phone, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    v_phone,
    'customer',
    'active'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone);

  -- Link or create customer record
  select id into v_existing_customer_id
  from public.customers
  where lower(email) = lower(new.email)
  order by created_at asc
  limit 1;

  if v_existing_customer_id is not null then
    update public.customers
    set user_id = new.id, updated_at = now()
    where id = v_existing_customer_id and user_id is null;
  else
    insert into public.customers (
      user_id,
      name,
      company,
      company_name,
      email,
      phone,
      status,
      customer_status
    ) values (
      new.id,
      v_full_name,
      new.raw_user_meta_data ->> 'company',
      new.raw_user_meta_data ->> 'company',
      new.email,
      v_phone,
      'active',
      'active'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Helper: Activity logging function
-- ---------------------------------------------------------------------------
create or replace function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.activity_logs (user_id, action, entity_type, entity_id, description)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_description)
  returning id into v_log_id;
  return v_log_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Row Level Security for new and modified tables
-- ---------------------------------------------------------------------------
alter table public.staff_details enable row level security;
alter table public.activity_logs enable row level security;

-- staff_details policies
drop policy if exists "Staff details: read own or admin read all" on public.staff_details;
create policy "Staff details: read own or admin read all"
  on public.staff_details for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Staff details: admin manage" on public.staff_details;
create policy "Staff details: admin manage"
  on public.staff_details for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- activity_logs policies (append-only audit trail)
drop policy if exists "Activity logs: admin read" on public.activity_logs;
create policy "Activity logs: admin read"
  on public.activity_logs for select to authenticated
  using (public.is_admin());

drop policy if exists "Activity logs: authenticated insert" on public.activity_logs;
create policy "Activity logs: authenticated insert"
  on public.activity_logs for insert to authenticated
  with check (user_id = auth.uid() or user_id is null or public.is_admin());

-- Customers update policy: allow portal customers to update their own contact details
drop policy if exists "Customers: portal user updates own record" on public.customers;
create policy "Customers: portal user updates own record"
  on public.customers for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Subscriptions insert policy for customer self-service subscription
drop policy if exists "Subscriptions: customer creates own" on public.subscriptions;
create policy "Subscriptions: customer creates own"
  on public.subscriptions for insert to authenticated
  with check (
    exists (
      select 1 from public.customers c
      where c.id = subscriptions.customer_id and c.user_id = auth.uid()
    )
  );

-- Grants
grant select, insert, update on public.staff_details to authenticated, service_role;
grant select, insert on public.activity_logs to authenticated, service_role;
grant execute on function public.log_activity to authenticated, service_role;
