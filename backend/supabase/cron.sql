-- Supabase Cron setup for daily recurring billing.
-- 1. Deploy the edge function:
--      supabase functions deploy generate-invoices --no-verify-jwt
-- 2. Set secrets (the function uses these automatically):
--      supabase secrets set BILLING_CRON_SECRET=your-random-secret
-- 3. Run this file in the SQL editor after replacing the project ref and secret.
--
-- The function is also idempotent: calling it twice in a day will not create
-- duplicate invoices for the same subscription period.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'brightloop-generate-invoices',
  '15 2 * * *', -- every day at 02:15 UTC
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-invoices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Inspect runs
-- select * from cron.job_run_details order by start_time desc limit 20;
