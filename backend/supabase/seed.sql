-- Demo data for local development or a fresh Supabase project.
-- Register your account after seeding, then promote it:
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
insert into public.customers (id, name, company, contact_name, email, phone, country, address, tax_id, status, notes, created_at)
values
  ('c0000000-0000-4000-8000-000000000001', 'Acme Corp', 'Acme Corporation', 'Jordan Blake', 'billing@acme.com', '+1 415 555 0101', 'United States', '3400 Hillview Ave, Palo Alto, CA', 'US-84-2210345', 'active', 'Expanding to 3 teams in Q4.', now() - interval '11 months'),
  ('c0000000-0000-4000-8000-000000000002', 'Northwind Labs', 'Northwind Laboratories', 'Priya Raman', 'finance@northwind.dev', '+44 20 7946 0312', 'United Kingdom', '12 Finsbury Square, London', 'GB-992 7812 44', 'active', 'Annual plan, auto-renew.', now() - interval '9 months'),
  ('c0000000-0000-4000-8000-000000000003', 'Lumen Studio', 'Lumen Design Studio', 'Sofia Marchetti', 'hello@lumen.studio', '+39 02 555 0198', 'Italy', 'Via Brera 21, Milan', 'IT-0918273645', 'active', 'Design agency, 8 seats.', now() - interval '7 months'),
  ('c0000000-0000-4000-8000-000000000004', 'Atlas Freight', 'Atlas Freight GmbH', 'Lukas Weber', 'ap@atlasfreight.de', '+49 30 555 0177', 'Germany', 'Friedrichstraße 88, Berlin', 'DE-811907980', 'active', 'Needs invoice PDFs in German.', now() - interval '6 months'),
  ('c0000000-0000-4000-8000-000000000005', 'Vela Health', 'Vela Health Inc.', 'Maya Chen', 'billing@velahealth.co', '+1 646 555 0142', 'United States', '55 Hudson Yards, New York, NY', 'US-47-9932011', 'active', 'HIPAA review completed.', now() - interval '4 months'),
  ('c0000000-0000-4000-8000-000000000006', 'Sable & Co', 'Sable & Co. Consulting', 'Rebecca Hall', 'accounts@sableco.com', '+61 2 5550 0166', 'Australia', '19 Martin Place, Sydney', 'AU-220 991 883', 'inactive', 'Churned after pilot.', now() - interval '10 months'),
  ('c0000000-0000-4000-8000-000000000007', 'Kite Robotics', 'Kite Robotics Ltd.', 'Aarav Mehta', 'finance@kiterobotics.in', '+91 80 5550 0188', 'India', 'Prestige Tech Park, Bengaluru', 'IN-29AABCU9603R1Z', 'active', 'Fast growing, 25 seats.', now() - interval '3 months'),
  ('c0000000-0000-4000-8000-000000000008', 'Orbit Analytics', 'Orbit Analytics SAS', 'Camille Dubois', 'factures@orbitanalytics.fr', '+33 1 55 55 01 92', 'France', '8 Rue de la Paix, Paris', 'FR-732829320', 'active', 'Monthly, card payment.', now() - interval '2 months')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Products & plans
-- ---------------------------------------------------------------------------
insert into public.products (id, name, description, category, base_price, is_active)
values
  ('d0000000-0000-4000-8000-000000000001', 'Brightloop Core', 'Workflow automation platform for growing teams.', 'Platform', 29, true),
  ('d0000000-0000-4000-8000-000000000002', 'Brightloop Insights', 'Revenue analytics and forecasting add-on.', 'Analytics', 19, true),
  ('d0000000-0000-4000-8000-000000000003', 'Brightloop Connect', 'Customer portal and branded billing experience.', 'Platform', 15, true),
  ('d0000000-0000-4000-8000-000000000004', 'Brightloop Guard', 'Advanced permissions, audit logs and SSO.', 'Security', 49, true),
  ('d0000000-0000-4000-8000-000000000005', 'Onboarding Plus', 'White-glove migration and onboarding.', 'Services', 499, true)
on conflict (id) do nothing;

insert into public.plans (id, product_id, name, description, price, interval, interval_count, trial_days, features, is_active)
values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Starter', 'For small teams getting started with automation.', 29, 'monthly', 1, 14, array['Up to 5 seats', '10 workflows', 'Email support'], true),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Growth', 'Scale automation across the whole company.', 99, 'monthly', 1, 14, array['Up to 25 seats', 'Unlimited workflows', 'Priority support', 'Insights add-on'], true),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'Scale Annual', 'Annual contract with two months free.', 990, 'yearly', 1, 0, array['Up to 100 seats', 'Unlimited workflows', 'Dedicated CSM', 'SSO included'], true),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002', 'Insights', 'Revenue analytics for finance and growth teams.', 19, 'monthly', 1, 7, array['Revenue dashboards', 'Cohort analysis', 'CSV exports'], true),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', 'Guard', 'Enterprise security and compliance controls.', 49, 'monthly', 1, 0, array['SSO / SAML', 'Audit log', 'Custom roles', 'SOC 2 report'], true),
  ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000003', 'Connect', 'Branded customer portal for your billing.', 15, 'monthly', 1, 14, array['Branded portal', 'Invoice history', 'Payment methods'], true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Taxes & discounts
-- ---------------------------------------------------------------------------
insert into public.taxes (id, name, rate, country, is_default, is_active)
values
  ('f0000000-0000-4000-8000-000000000001', 'US Sales Tax', 8.25, 'United States', false, true),
  ('f0000000-0000-4000-8000-000000000002', 'UK VAT', 20, 'United Kingdom', false, true),
  ('f0000000-0000-4000-8000-000000000003', 'India GST', 18, 'India', true, true)
on conflict (id) do nothing;

insert into public.discounts (id, code, description, type, value, is_active, valid_from, valid_until, max_redemptions, times_redeemed)
values
  ('a0000000-0000-4000-8000-000000000001', 'LAUNCH20', '20% off the first year for launch customers.', 'percentage', 20, true, current_date - interval '90 days', current_date + interval '275 days', 100, 12),
  ('a0000000-0000-4000-8000-000000000002', 'ANNUAL50', '$50 off annual plans.', 'fixed', 50, true, current_date - interval '60 days', current_date + interval '300 days', null, 4),
  ('a0000000-0000-4000-8000-000000000003', 'PARTNER15', '15% partner referral discount.', 'percentage', 15, false, current_date - interval '180 days', current_date + interval '180 days', 50, 7)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
insert into public.subscriptions (id, customer_id, plan_id, status, quantity, started_at, current_period_start, current_period_end, trial_end, cancel_at_period_end, discount_id, tax_id, notes, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'active', 12, current_date - interval '11 months', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, null, false, 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Expansion deal, 12 seats.', now() - interval '11 months'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003', 'active', 1, current_date - interval '9 months', (date_trunc('year', current_date))::date, (date_trunc('year', current_date) + interval '1 year')::date, null, false, null, 'f0000000-0000-4000-8000-000000000002', 'Annual prepay.', now() - interval '9 months'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000005', 'active', 8, current_date - interval '7 months', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, null, false, null, null, 'Security add-on.', now() - interval '7 months'),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000004', 'active', 1, current_date - interval '5 months', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, null, false, null, null, null, now() - interval '5 months'),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 'past_due', 5, current_date - interval '6 months', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, null, false, null, null, 'Card expired — chasing AP.', now() - interval '6 months'),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000002', 'active', 15, current_date - interval '4 months', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, null, false, null, null, null, now() - interval '4 months'),
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000006', 'active', 15, current_date - interval '4 months', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, null, false, null, null, null, now() - interval '4 months'),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000003', 'trialing', 25, current_date - interval '10 days', current_date - interval '10 days', current_date + interval '4 days', current_date + interval '4 days', false, null, 'f0000000-0000-4000-8000-000000000003', 'Trial converted from quotation QUO-2026-0002.', now() - interval '10 days'),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000001', 'active', 3, current_date - interval '2 months', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, null, false, null, null, null, now() - interval '2 months'),
  ('b0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'active', 1, current_date - interval '3 months', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, null, false, null, null, null, now() - interval '3 months'),
  ('b0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000001', 'canceled', 1, current_date - interval '10 months', current_date - interval '3 months', current_date - interval '2 months', null, true, null, null, 'Pilot ended.', now() - interval '10 months'),
  ('b0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000004', 'paused', 1, current_date - interval '5 months', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, null, false, null, null, 'Paused while migrating ERP.', now() - interval '5 months')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------
insert into public.quotations (id, number, customer_id, status, issue_date, valid_until, subtotal, discount_total, tax_total, total, notes, terms, created_at)
values
  ('70000000-0000-4000-8000-000000000001', 'QUO-2026-0001', 'c0000000-0000-4000-8000-000000000007', 'sent', current_date - interval '12 days', current_date + interval '18 days', 11880, 1782, 1817.64, 11915.64, '25-seat Scale annual with onboarding.', 'Valid for 30 days. 50% due on signature.', now() - interval '12 days'),
  ('70000000-0000-4000-8000-000000000002', 'QUO-2026-0002', 'c0000000-0000-4000-8000-000000000005', 'accepted', current_date - interval '34 days', current_date + interval '5 days', 1782, 0, 0, 1782, 'Additional Connect seats.', 'Net 30.', now() - interval '34 days'),
  ('70000000-0000-4000-8000-000000000003', 'QUO-2026-0003', 'c0000000-0000-4000-8000-000000000002', 'draft', current_date - interval '2 days', current_date + interval '28 days', 499, 0, 0, 499, 'Onboarding Plus for London team.', 'One-time service.', now() - interval '2 days'),
  ('70000000-0000-4000-8000-000000000004', 'QUO-2026-0004', 'c0000000-0000-4000-8000-000000000003', 'declined', current_date - interval '45 days', current_date - interval '15 days', 1188, 0, 0, 1188, 'Annual Growth upgrade.', 'Expired.', now() - interval '45 days'),
  ('70000000-0000-4000-8000-000000000005', 'QUO-2026-0005', 'c0000000-0000-4000-8000-000000000008', 'expired', current_date - interval '62 days', current_date - interval '32 days', 990, 50, 0, 940, 'Annual Scale.', 'Expired.', now() - interval '62 days')
on conflict (id) do nothing;

insert into public.quotation_items (quotation_id, description, quantity, unit_price, amount, sort_order)
select
  v.quotation_id::uuid, v.description, v.quantity, v.unit_price, v.amount, v.sort_order
from (values
  ('70000000-0000-4000-8000-000000000001', 'Scale Annual — 25 seats', 12, 990, 11880, 0),
  ('70000000-0000-4000-8000-000000000002', 'Connect — additional 15 seats', 6, 297, 1782, 0),
  ('70000000-0000-4000-8000-000000000003', 'Onboarding Plus', 1, 499, 499, 0),
  ('70000000-0000-4000-8000-000000000004', 'Growth annual upgrade', 1, 1188, 1188, 0),
  ('70000000-0000-4000-8000-000000000005', 'Scale Annual', 1, 990, 990, 0)
) as v(quotation_id, description, quantity, unit_price, amount, sort_order)
where not exists (select 1 from public.quotation_items);

-- ---------------------------------------------------------------------------
-- Invoices — six months of billing history generated from subscriptions
-- ---------------------------------------------------------------------------
do $$
declare
  s record;
  m integer;
  seq integer := 0;
  v_invoice_id uuid;
  v_issue date;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_rate numeric(5,2);
  v_paid boolean;
  v_number text;
begin
  -- Idempotency guard: only generate billing history on an empty invoices table.
  if exists (select 1 from public.invoices) then
    raise notice 'Invoices already present — skipping demo billing history.';
    return;
  end if;

  for s in
    select
      sub.id, sub.customer_id, sub.quantity, sub.started_at, sub.status,
      p.price, p.interval, p.name as plan_name,
      d.type as discount_type, d.value as discount_value,
      coalesce(t.rate, 0) as tax_rate
    from public.subscriptions sub
    join public.plans p on p.id = sub.plan_id
    left join public.discounts d on d.id = sub.discount_id
    left join public.taxes t on t.id = sub.tax_id
  loop
    for m in 0..5 loop
      v_issue := (date_trunc('month', current_date) - (m || ' months')::interval + interval '3 days')::date;
      if v_issue < s.started_at then
        continue;
      end if;

      v_subtotal := round(s.price * s.quantity, 2);
      v_discount := 0;
      if s.discount_type = 'percentage' then
        v_discount := round(v_subtotal * s.discount_value / 100, 2);
      elsif s.discount_type = 'fixed' then
        v_discount := least(s.discount_value, v_subtotal);
      end if;
      v_tax := round((v_subtotal - v_discount) * s.tax_rate / 100, 2);
      v_total := v_subtotal - v_discount + v_tax;
      v_paid := m > 0;

      seq := seq + 1;
      v_number := 'INV-' || to_char(v_issue, 'YYYY') || '-' || lpad(seq::text, 4, '0');
      v_invoice_id := gen_random_uuid();

      insert into public.invoices (
        id, number, customer_id, subscription_id, status, issue_date, due_date,
        period_start, period_end, subtotal, discount_total, tax_total, total,
        amount_paid, notes, created_at
      ) values (
        v_invoice_id, v_number, s.customer_id, s.id,
        case when v_paid then 'paid'::public.invoice_status else 'open'::public.invoice_status end,
        v_issue, v_issue + 14,
        v_issue, (v_issue + interval '1 month')::date,
        v_subtotal, v_discount, v_tax, v_total,
        0,
        null,
        v_issue::timestamptz
      );

      insert into public.invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order)
      values (
        v_invoice_id,
        s.plan_name || ' subscription',
        s.quantity,
        s.price,
        v_subtotal,
        0
      );

      if v_paid then
        insert into public.payments (invoice_id, customer_id, amount, method, reference, paid_at, created_at)
        values (
          v_invoice_id, s.customer_id, v_total,
          case when m % 3 = 0 then 'bank_transfer'::public.payment_method else 'card'::public.payment_method end,
          'seed-' || v_number,
          (v_issue + 4)::timestamptz,
          (v_issue + 4)::timestamptz
        );
      end if;
    end loop;
  end loop;

  -- One draft invoice for the pipeline
  insert into public.invoices (
    number, customer_id, status, issue_date, due_date, subtotal, discount_total, tax_total, total, notes
  ) values (
    'INV-2026-9' || lpad(seq::text, 3, '0'),
    'c0000000-0000-4000-8000-000000000002',
    'draft', current_date, current_date + 14, 499, 0, 0, 499, 'Draft onboarding invoice'
  );
end $$;

update public.counters
set value = (select count(*) from public.invoices)
where kind = 'invoice:' || to_char(now(), 'YYYY');
insert into public.counters (kind, value)
values ('invoice:' || to_char(now(), 'YYYY'), (select count(*) from public.invoices))
on conflict (kind) do update set value = greatest(public.counters.value, excluded.value);

-- Settings
update public.app_settings
set
  company_name = 'Brightloop Software',
  support_email = 'billing@brightloop.io',
  currency = 'USD',
  invoice_prefix = 'INV',
  invoice_due_days = 14,
  default_tax_id = 'f0000000-0000-4000-8000-000000000003',
  address = '228 Market Street, Suite 900, San Francisco, CA 94105'
where id = 1;
