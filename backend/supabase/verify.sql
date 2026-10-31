-- Brightloop installation checks.
-- Run in the Supabase SQL Editor after applying the migrations (and optionally the seed).
-- Every row should report "ok" (seed counts can be 0 on a production project).

-- RLS coverage: every public table must have row level security enabled.
select
  'rls_enabled' as check,
  case when bool_and(rowsecurity) then 'ok' else 'fail' end as result,
  count(*) filter (where not rowsecurity)::text || ' table(s) without RLS' as detail
from pg_tables
where schemaname = 'public';

-- Expected table set.
select
  'public_tables' as check,
  case when count(*) = 14 then 'ok' else 'fail' end as result,
  count(*)::text || ' of 14 tables present' as detail
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles', 'customers', 'products', 'plans', 'subscriptions',
    'quotations', 'quotation_items', 'invoices', 'invoice_items',
    'payments', 'discounts', 'taxes', 'app_settings', 'counters'
  );

-- Policy coverage.
select
  'rls_policies' as check,
  case when count(*) >= 30 then 'ok' else 'fail' end as result,
  count(*)::text || ' policies defined' as detail
from pg_policies
where schemaname = 'public';

-- Private storage bucket for invoice PDFs.
select
  'storage_bucket' as check,
  case when count(*) = 1 then 'ok' else 'fail' end as result,
  coalesce(string_agg(name || ' (public=' || public || ')', ', '), 'missing') as detail
from storage.buckets
where id = 'documents';

-- Document numbering function.
select
  'document_numbering' as check,
  case when count(*) = 1 then 'ok' else 'fail' end as result,
  count(*)::text || ' next_document_number() definition(s)' as detail
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'next_document_number';

-- Demo data (optional; expect 0 on a clean production database).
select
  'seed_data' as check,
  case
    when (select count(*) from public.customers) = 0 then 'empty'
    when (select count(*) from public.subscriptions) > 0 then 'ok'
    else 'partial'
  end as result,
  format(
    '%s customers, %s plans, %s subscriptions, %s invoices, %s payments',
    (select count(*) from public.customers),
    (select count(*) from public.plans),
    (select count(*) from public.subscriptions),
    (select count(*) from public.invoices),
    (select count(*) from public.payments)
  ) as detail;
