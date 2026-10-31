# Brightloop — Backend (Supabase)

This directory contains the database schema, security policies, automation triggers, demo seed data, Edge Functions, and recurring cron configuration for **Brightloop Software**.

---

## Directory Structure

```
backend/
├── supabase/
│   ├── migrations/
│   │   ├── 20261031000100_schema.sql  # Normalized PostgreSQL schema, functions, triggers
│   │   └── 20261031000200_rls.sql     # Zero-trust Row-Level Security (RLS) policies
│   ├── functions/
│   │   └── generate-invoices/         # Edge Function for idempotent recurring billing
│   │       └── index.ts
│   ├── seed.sql                       # 15 customers, 8 products, 12 plans, subscriptions, invoices, payments
│   ├── cron.sql                       # pg_cron scheduled job invoking generate-invoices daily
│   ├── verify.sql                     # Health check queries to verify setup & RLS
│   └── config.toml                    # Supabase CLI configuration
├── .env.example                       # Backend environment template
└── README.md                          # Documentation
```

---

## Setup & Deployment

### 1. Apply Database Migrations

Using the Supabase CLI (from the `backend` folder):

```bash
cd backend
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

*Alternatively, copy and paste the contents of `supabase/migrations/20261031000100_schema.sql` and `supabase/migrations/20261031000200_rls.sql` directly into your Supabase Dashboard SQL Editor.*

### 2. Seed Realistic Demo Data

Run `supabase/seed.sql` using psql or the Supabase SQL Editor:

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

### 3. Deploy Recurring Billing Edge Function

```bash
cd backend
npx supabase functions deploy generate-invoices --no-verify-jwt
npx supabase secrets set BILLING_CRON_SECRET=your-random-cron-secret
```

### 4. Enable Daily Recurring Billing Cron

Execute `supabase/cron.sql` in the Supabase SQL editor with your `PROJECT_REF` and `BILLING_CRON_SECRET` replaced. It runs automatically every day at 02:15 UTC to bill eligible subscriptions.

---

## Security Model (RLS)

- **Admin**: Full read/write access across all tables, system configuration, and financial reports.
- **Staff**: Operational access (customers, quotations, subscriptions, invoices, payments). Read-only for catalogs.
- **Customer**: Access restricted exclusively to rows where `customer.user_id = auth.uid()`.
- **Idempotency**: `invoices` enforces `UNIQUE NULLS NOT DISTINCT (subscription_id, period_start, period_end)` to prevent duplicate billing.
