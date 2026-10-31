-- Brightloop Software — subscription management schema
-- Run with: supabase db push  (or paste into the Supabase SQL editor)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'staff', 'customer');
create type public.billing_interval as enum ('monthly', 'quarterly', 'yearly');
create type public.subscription_status as enum ('trialing', 'active', 'paused', 'past_due', 'canceled');
create type public.invoice_status as enum ('draft', 'open', 'paid', 'void', 'uncollectible');
create type public.quotation_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');
create type public.payment_method as enum ('card', 'bank_transfer', 'cash', 'other');
create type public.discount_type as enum ('percentage', 'fixed');

-- ---------------------------------------------------------------------------
-- Profiles (application roles live here, linked to auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'customer',
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  name text not null,
  company text,
  contact_name text,
  email text not null,
  phone text,
  country text,
  address text,
  tax_id text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_email_idx on public.customers (email);
create index customers_user_id_idx on public.customers (user_id);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  base_price numeric(12, 2) not null default 0 check (base_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  interval public.billing_interval not null default 'monthly',
  interval_count integer not null default 1 check (interval_count between 1 and 36),
  trial_days integer not null default 0 check (trial_days between 0 and 365),
  features text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.taxes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rate numeric(5, 2) not null default 0 check (rate between 0 and 100),
  country text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  type public.discount_type not null default 'percentage',
  value numeric(12, 2) not null default 0 check (value >= 0),
  is_active boolean not null default true,
  valid_from date,
  valid_until date,
  max_redemptions integer,
  times_redeemed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status public.subscription_status not null default 'active',
  quantity integer not null default 1 check (quantity > 0),
  started_at date not null default current_date,
  current_period_start date not null default current_date,
  current_period_end date not null,
  trial_end date,
  canceled_at timestamptz,
  cancel_at_period_end boolean not null default false,
  discount_id uuid references public.discounts (id) on delete set null,
  tax_id uuid references public.taxes (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_customer_idx on public.subscriptions (customer_id);
create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end);

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid not null references public.customers (id) on delete cascade,
  status public.quotation_status not null default 'draft',
  issue_date date not null default current_date,
  valid_until date not null,
  subtotal numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  tax_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  terms text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotations_customer_idx on public.quotations (customer_id);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  amount numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index quotation_items_quotation_idx on public.quotation_items (quotation_id);

-- ---------------------------------------------------------------------------
-- Invoices & payments
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid not null references public.customers (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date not null default current_date,
  period_start date,
  period_end date,
  subtotal numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  tax_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  notes text,
  pdf_path text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_customer_idx on public.invoices (customer_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_issue_date_idx on public.invoices (issue_date desc);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  amount numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method public.payment_method not null default 'card',
  reference text,
  paid_at timestamptz not null default now(),
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_customer_idx on public.payments (customer_id);
create index payments_paid_at_idx on public.payments (paid_at desc);

-- ---------------------------------------------------------------------------
-- Settings, counters
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id integer primary key default 1 check (id = 1),
  company_name text not null default 'Brightloop Software',
  support_email text not null default 'billing@brightloop.io',
  currency text not null default 'USD',
  invoice_prefix text not null default 'INV',
  invoice_due_days integer not null default 14,
  default_tax_id uuid references public.taxes (id) on delete set null,
  address text,
  logo_url text,
  updated_at timestamptz not null default now()
);

create table public.counters (
  kind text primary key,
  value bigint not null default 0
);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'staff') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only administrators can change application roles';
  end if;
  return new;
end;
$$;

create or replace function public.next_document_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value bigint;
  v_year text := to_char(now(), 'YYYY');
  v_key text := p_kind || ':' || to_char(now(), 'YYYY');
  v_prefix text;
begin
  -- Only staff sessions and service-role/server jobs may allocate numbers.
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Not authorized to allocate document numbers';
  end if;
  insert into public.counters (kind, value)
  values (v_key, 1)
  on conflict (kind) do update set value = public.counters.value + 1
  returning value into v_value;

  v_prefix := case p_kind
    when 'invoice' then 'INV'
    when 'quotation' then 'QUO'
    else upper(p_kind)
  end;

  return v_prefix || '-' || v_year || '-' || lpad(v_value::text, 4, '0');
end;
$$;

create or replace function public.sync_invoice_amount_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_paid numeric(12, 2);
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  if v_invoice_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where invoice_id = v_invoice_id;

  update public.invoices
  set
    amount_paid = v_paid,
    status = case
      when status in ('void', 'uncollectible') then status
      when v_paid >= total and total > 0 then 'paid'::public.invoice_status
      when status = 'paid' and v_paid < total then 'open'::public.invoice_status
      else status
    end,
    updated_at = now()
  where id = v_invoice_id;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function public.customer_cancel_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions s
  set cancel_at_period_end = true, updated_at = now()
  where s.id = p_subscription_id
    and exists (
      select 1 from public.customers c
      where c.id = s.customer_id and c.user_id = auth.uid()
    );

  if not found then
    raise exception 'Subscription not found or not owned by the current user';
  end if;
end;
$$;

create or replace function public.customer_resume_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions s
  set cancel_at_period_end = false, updated_at = now()
  where s.id = p_subscription_id
    and s.status <> 'canceled'
    and exists (
      select 1 from public.customers c
      where c.id = s.customer_id and c.user_id = auth.uid()
    );

  if not found then
    raise exception 'Subscription not found or cannot be resumed';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();
create trigger taxes_updated_at before update on public.taxes
  for each row execute function public.set_updated_at();
create trigger discounts_updated_at before update on public.discounts
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger quotations_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create trigger payments_sync_invoice
  after insert or update or delete on public.payments
  for each row execute function public.sync_invoice_amount_paid();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
revoke all on public.counters from anon, authenticated;

insert into public.app_settings (id) values (1) on conflict (id) do nothing;
