-- Migration: 20261031000300_extensions.sql
-- Description: Non-destructive extensions to support required backend modules:
-- 1. Partial unique index on invoices for subscription billing period idempotency
-- 2. Enum value additions for intervals, quotation statuses, subscription statuses, invoice statuses, and payment methods
-- 3. product_variants table for product variant management
-- 4. quotation_templates table for quotation template support
-- 5. subscription_lines table for multi-line subscription items
-- 6. subscription_events table and trigger for lifecycle event logging
-- 7. discount_usage table for tracking per-invoice/customer discount redemptions
-- 8. Row-Level Security (RLS) policies for all new tables

-- ---------------------------------------------------------------------------
-- 1. Invoices Idempotency Index
-- ---------------------------------------------------------------------------
create unique index if not exists invoices_subscription_period_idx
  on public.invoices (subscription_id, period_start, period_end)
  where subscription_id is not null and period_start is not null and period_end is not null;

-- ---------------------------------------------------------------------------
-- 2. Enum Extensions
-- ---------------------------------------------------------------------------
alter type public.billing_interval add value if not exists 'daily';
alter type public.billing_interval add value if not exists 'weekly';

alter type public.quotation_status add value if not exists 'converted';

alter type public.subscription_status add value if not exists 'draft';
alter type public.subscription_status add value if not exists 'quotation';
alter type public.subscription_status add value if not exists 'confirmed';
alter type public.subscription_status add value if not exists 'closed';

alter type public.invoice_status add value if not exists 'confirmed';
alter type public.invoice_status add value if not exists 'partially_paid';
alter type public.invoice_status add value if not exists 'overdue';
alter type public.invoice_status add value if not exists 'cancelled';

alter type public.payment_method add value if not exists 'upi';

-- ---------------------------------------------------------------------------
-- 3. Product Variants
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  sku text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_variants_product_idx on public.product_variants (product_id);

create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Quotation Templates
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  items jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger quotation_templates_updated_at before update on public.quotation_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Subscription Lines
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_lines (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  plan_id uuid references public.plans (id) on delete set null,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  amount numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists subscription_lines_sub_idx on public.subscription_lines (subscription_id);

-- ---------------------------------------------------------------------------
-- 6. Subscription Events & Trigger
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  details jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_sub_idx on public.subscription_events (subscription_id);

create or replace function public.log_subscription_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.subscription_events (subscription_id, event_type, to_status, details, created_by)
    values (new.id, 'created', new.status::text, jsonb_build_object('quantity', new.quantity, 'started_at', new.started_at), new.created_by);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.subscription_events (subscription_id, event_type, from_status, to_status, details, created_by)
    values (new.id, 'status_change', old.status::text, new.status::text, jsonb_build_object('cancel_at_period_end', new.cancel_at_period_end), auth.uid());
  end if;
  return new;
end;
$$;

create trigger subscriptions_event_logger
  after insert or update on public.subscriptions
  for each row execute function public.log_subscription_status_event();

-- ---------------------------------------------------------------------------
-- 7. Discount Usage
-- ---------------------------------------------------------------------------
create table if not exists public.discount_usage (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  redeemed_at timestamptz not null default now()
);
create index if not exists discount_usage_discount_idx on public.discount_usage (discount_id);

-- ---------------------------------------------------------------------------
-- 8. Row-Level Security for New Tables
-- ---------------------------------------------------------------------------
alter table public.product_variants enable row level security;
alter table public.quotation_templates enable row level security;
alter table public.subscription_lines enable row level security;
alter table public.subscription_events enable row level security;
alter table public.discount_usage enable row level security;

-- Product variants
create policy "Product variants: staff read"
  on public.product_variants for select to authenticated
  using (public.is_staff());

create policy "Product variants: authenticated read active"
  on public.product_variants for select to authenticated
  using (is_active = true);

create policy "Product variants: admin manage"
  on public.product_variants for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Quotation templates
create policy "Quotation templates: staff manage"
  on public.quotation_templates for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Quotation templates: authenticated read active"
  on public.quotation_templates for select to authenticated
  using (is_active = true);

-- Subscription lines
create policy "Subscription lines: staff manage"
  on public.subscription_lines for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Subscription lines: customer reads own"
  on public.subscription_lines for select to authenticated
  using (
    exists (
      select 1
      from public.subscriptions s
      join public.customers c on c.id = s.customer_id
      where s.id = subscription_lines.subscription_id and c.user_id = auth.uid()
    )
  );

-- Subscription events
create policy "Subscription events: staff manage"
  on public.subscription_events for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Subscription events: customer reads own"
  on public.subscription_events for select to authenticated
  using (
    exists (
      select 1
      from public.subscriptions s
      join public.customers c on c.id = s.customer_id
      where s.id = subscription_events.subscription_id and c.user_id = auth.uid()
    )
  );

-- Discount usage
create policy "Discount usage: staff manage"
  on public.discount_usage for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Discount usage: customer reads own"
  on public.discount_usage for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = discount_usage.customer_id and c.user_id = auth.uid()
    )
  );

-- Grants
grant all on public.product_variants to authenticated, service_role;
grant all on public.quotation_templates to authenticated, service_role;
grant all on public.subscription_lines to authenticated, service_role;
grant all on public.subscription_events to authenticated, service_role;
grant all on public.discount_usage to authenticated, service_role;
