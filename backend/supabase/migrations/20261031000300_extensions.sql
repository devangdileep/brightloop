-- Migration: 20261031000300_extensions.sql
-- Description: Non-destructive extensions aligning with Brightloop schema & requirements:
-- 1. Partial unique index on invoices for subscription billing period idempotency (with diagnostic duplicate reporting & resolution plan)
-- 2. Enum value additions for intervals, quotation statuses, subscription statuses, invoice statuses, and payment methods
-- 3. product_variants table with attributes, cost_price, price_modifier (canonical modifier model without duplicate price column)
-- 4. quotation_templates table with default_validity_days, default_notes, terms, and template_lines (without duplicate generated items)
-- 5. subscription_lines table with variant_id, billing_frequency (public.billing_interval), and updated_at
-- 6. subscription_events table with description and payload (without duplicate generated details), plus lifecycle trigger
-- 7. discount_usage table with subscription_id, discount_amount, and applied_at (without duplicate generated amount)
-- 8. sync_invoice_amount_paid() trigger supporting draft, open, confirmed, paid, partially_paid, overdue, and cancelled
-- 9. Row-Level Security (RLS) policies and permissions for all new objects

-- ---------------------------------------------------------------------------
-- 1. Invoices Idempotency Index (with duplicate verification & resolution report)
-- ---------------------------------------------------------------------------
do $$
declare
  v_dup_count integer;
  v_dup_details text;
begin
  select count(*), string_agg(format('subscription %s, period %s to %s (%s invoices)', subscription_id, period_start, period_end, cnt), E'\n  ')
  into v_dup_count, v_dup_details
  from (
    select subscription_id, period_start, period_end, count(*) as cnt
    from public.invoices
    where subscription_id is not null and period_start is not null and period_end is not null
    group by subscription_id, period_start, period_end
    having count(*) > 1
  ) dups;

  if v_dup_count > 0 then
    raise exception 'Cannot enforce billing idempotency: % duplicate billing period set(s) found in public.invoices:
  %
Safe Resolution Plan:
1. Inspect duplicates:
   SELECT subscription_id, period_start, period_end, array_agg(id ORDER BY created_at) AS invoice_ids, array_agg(status) AS statuses
   FROM public.invoices
   WHERE subscription_id IS NOT NULL AND period_start IS NOT NULL AND period_end IS NOT NULL
   GROUP BY subscription_id, period_start, period_end
   HAVING count(*) > 1;
2. If one invoice is paid, retain it and mark redundant drafts/unpaid duplicates as void/cancelled or nullify their period_start/period_end.
3. Re-run migration once all duplicate periods have been deduplicated.', v_dup_count, v_dup_details;
  else
    execute 'create unique index if not exists invoices_subscription_period_idx on public.invoices (subscription_id, period_start, period_end) where subscription_id is not null and period_start is not null and period_end is not null';
  end if;
end;
$$;

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
-- 3. Product Variants (Canonical price_modifier model)
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  sku text,
  attributes jsonb not null default '{}'::jsonb,
  cost_price numeric(12, 2) not null default 0.00 check (cost_price >= 0),
  price_modifier numeric(12, 2) not null default 0.00,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_idx on public.product_variants (product_id);

alter table public.product_variants add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.product_variants add column if not exists cost_price numeric(12, 2) not null default 0.00;
alter table public.product_variants add column if not exists price_modifier numeric(12, 2) not null default 0.00;
alter table public.product_variants add column if not exists sku text;
alter table public.product_variants add column if not exists is_active boolean not null default true;

drop trigger if exists product_variants_updated_at on public.product_variants;
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Quotation Templates (Canonical template_lines column)
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_validity_days integer not null default 30 check (default_validity_days > 0),
  default_notes text,
  terms text,
  template_lines jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotation_templates add column if not exists default_validity_days integer not null default 30;
alter table public.quotation_templates add column if not exists default_notes text;
alter table public.quotation_templates add column if not exists terms text;
alter table public.quotation_templates add column if not exists template_lines jsonb not null default '[]'::jsonb;

drop trigger if exists quotation_templates_updated_at on public.quotation_templates;
create trigger quotation_templates_updated_at before update on public.quotation_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Subscription Lines (Validated billing_interval enum)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_lines (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  plan_id uuid references public.plans (id) on delete set null,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  amount numeric(12, 2) not null default 0,
  billing_frequency public.billing_interval not null default 'monthly',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_lines_sub_idx on public.subscription_lines (subscription_id);
create index if not exists subscription_lines_variant_idx on public.subscription_lines (variant_id);

alter table public.subscription_lines add column if not exists variant_id uuid references public.product_variants (id) on delete set null;
alter table public.subscription_lines add column if not exists updated_at timestamptz not null default now();

drop trigger if exists subscription_lines_updated_at on public.subscription_lines;
create trigger subscription_lines_updated_at before update on public.subscription_lines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Subscription Events & Trigger (Canonical payload column)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  description text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_sub_idx on public.subscription_events (subscription_id);

alter table public.subscription_events add column if not exists description text;
alter table public.subscription_events add column if not exists payload jsonb not null default '{}'::jsonb;

create or replace function public.log_subscription_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.subscription_events (
      subscription_id,
      event_type,
      from_status,
      to_status,
      description,
      payload,
      created_by
    )
    values (
      new.id,
      'created',
      null,
      new.status::text,
      'Subscription created with status ' || new.status::text,
      jsonb_build_object(
        'quantity', new.quantity,
        'started_at', new.started_at,
        'current_period_start', new.current_period_start,
        'current_period_end', new.current_period_end
      ),
      new.created_by
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.subscription_events (
      subscription_id,
      event_type,
      from_status,
      to_status,
      description,
      payload,
      created_by
    )
    values (
      new.id,
      case
        when new.status = 'active' and old.status = 'trialing' then 'trial_converted'
        when new.status = 'active' and old.status = 'paused' then 'resumed'
        when new.status = 'paused' then 'paused'
        when new.status in ('canceled', 'closed') then 'canceled'
        when new.status = 'past_due' then 'past_due'
        when new.status = 'confirmed' then 'confirmed'
        else 'status_change'
      end,
      old.status::text,
      new.status::text,
      'Subscription status changed from ' || old.status::text || ' to ' || new.status::text,
      jsonb_build_object(
        'cancel_at_period_end', new.cancel_at_period_end,
        'current_period_end', new.current_period_end
      ),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_event_logger on public.subscriptions;
create trigger subscriptions_event_logger
  after insert or update on public.subscriptions
  for each row execute function public.log_subscription_status_event();

-- ---------------------------------------------------------------------------
-- 7. Discount Usage (Canonical discount_amount column)
-- ---------------------------------------------------------------------------
create table if not exists public.discount_usage (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  applied_at timestamptz not null default now()
);

create index if not exists discount_usage_discount_idx on public.discount_usage (discount_id);
create index if not exists discount_usage_subscription_idx on public.discount_usage (subscription_id);
create index if not exists discount_usage_customer_idx on public.discount_usage (customer_id);
create index if not exists discount_usage_invoice_idx on public.discount_usage (invoice_id);

alter table public.discount_usage add column if not exists subscription_id uuid references public.subscriptions (id) on delete cascade;
alter table public.discount_usage add column if not exists discount_amount numeric(12, 2) not null default 0;
alter table public.discount_usage add column if not exists applied_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 8. Invoice Payment Status Synchronization Trigger
-- ---------------------------------------------------------------------------
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
      -- Immutable / non-payable statuses must not be overwritten
      when status in ('draft', 'cancelled', 'void', 'uncollectible') then status
      -- Fully paid invoices must result in paid
      when v_paid >= total and total > 0 then 'paid'::public.invoice_status
      -- Partial payments must result in partially_paid
      when v_paid > 0 and v_paid < total then 'partially_paid'::public.invoice_status
      -- Zero payments: if payment was deleted/reversed, restore to overdue or open
      when v_paid = 0 then
        case
          when due_date is not null and due_date < current_date then 'overdue'::public.invoice_status
          when status in ('paid', 'partially_paid') then 'open'::public.invoice_status
          else status
        end
      else status
    end,
    updated_at = now()
  where id = v_invoice_id;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists payments_sync_invoice on public.payments;
create trigger payments_sync_invoice
  after insert or update or delete on public.payments
  for each row execute function public.sync_invoice_amount_paid();

-- ---------------------------------------------------------------------------
-- 9. Row-Level Security for New Tables
-- ---------------------------------------------------------------------------
alter table public.product_variants enable row level security;
alter table public.quotation_templates enable row level security;
alter table public.subscription_lines enable row level security;
alter table public.subscription_events enable row level security;
alter table public.discount_usage enable row level security;

-- Product variants
drop policy if exists "Product variants: staff read" on public.product_variants;
create policy "Product variants: staff read"
  on public.product_variants for select to authenticated
  using (public.is_staff());

drop policy if exists "Product variants: authenticated read active" on public.product_variants;
create policy "Product variants: authenticated read active"
  on public.product_variants for select to authenticated
  using (is_active = true);

drop policy if exists "Product variants: admin manage" on public.product_variants;
create policy "Product variants: admin manage"
  on public.product_variants for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Quotation templates
drop policy if exists "Quotation templates: staff manage" on public.quotation_templates;
create policy "Quotation templates: staff manage"
  on public.quotation_templates for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Quotation templates: authenticated read active" on public.quotation_templates;
create policy "Quotation templates: authenticated read active"
  on public.quotation_templates for select to authenticated
  using (is_active = true);

-- Subscription lines
drop policy if exists "Subscription lines: staff manage" on public.subscription_lines;
create policy "Subscription lines: staff manage"
  on public.subscription_lines for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Subscription lines: customer reads own" on public.subscription_lines;
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
drop policy if exists "Subscription events: staff manage" on public.subscription_events;
create policy "Subscription events: staff manage"
  on public.subscription_events for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Subscription events: customer reads own" on public.subscription_events;
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
drop policy if exists "Discount usage: staff manage" on public.discount_usage;
create policy "Discount usage: staff manage"
  on public.discount_usage for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Discount usage: customer reads own" on public.discount_usage;
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
