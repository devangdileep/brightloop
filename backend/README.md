# Brightloop — Backend (Supabase)

This directory contains the database schema, security policies, automation triggers, demo seed data, Edge Functions, and recurring cron configuration for **Brightloop Software**.

---

## Directory Structure

```
backend/
├── supabase/
│   ├── migrations/
│   │   ├── 20261031000100_schema.sql          # Normalized PostgreSQL schema, functions, triggers
│   │   ├── 20261031000200_rls.sql             # Zero-trust Row-Level Security (RLS) policies
│   │   └── 20261031000300_user_management.sql # User Management: staff_details, activity_logs, status & triggers
│   ├── functions/
│   │   └── generate-invoices/                 # Edge Function for idempotent recurring billing
│   │       └── index.ts
│   ├── seed.sql                               # Realistic customers, products, plans, subscriptions, invoices, payments
│   ├── cron.sql                               # pg_cron scheduled job invoking generate-invoices daily
│   ├── verify.sql                             # Health check queries to verify setup & RLS
│   └── config.toml                            # Supabase CLI configuration
├── .env.example                               # Backend environment template
└── README.md                                  # Documentation
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

*Alternatively, execute the migrations in order in your Supabase Dashboard SQL Editor:*
1. `supabase/migrations/20261031000100_schema.sql`
2. `supabase/migrations/20261031000200_rls.sql`
3. `supabase/migrations/20261031000300_user_management.sql`

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

## Role-Based Security & Permissions Model

| Role | Database & UI Capabilities | Restrictions & Route Guards |
| --- | --- | --- |
| **Admin** | Full access to `/admin/*`, user management (`staff_details`, status toggling, staff creation), discount/tax catalogs, activity audit logs, and analytics. | Cannot deactivate their own admin account. |
| **Staff** | Full operational access to `/staff/*` (customers, quotations, subscription activation/cancellation, invoices, manual payment logging). Read-only for plans/products. | Strictly blocked from `/admin/*`, cannot manage staff, cannot alter tax/discount catalogs, cannot change user roles. Redirected to `/staff/dashboard`. |
| **Customer** | Dedicated `/portal/*` (browse plans, self-subscribe, view/cancel own subscriptions, view/download invoice PDFs, view payment receipts, update profile/password). | Blocked from `/admin/*` and `/staff/*`. Database RLS strictly isolates rows to `customer.user_id = auth.uid()`. Inactive/suspended accounts cannot log in. |

### Core User Management Additions
- **`profiles.status`**: `active`, `inactive`, `suspended`. Inactive users are rejected at login and signed out by the middleware/proxy.
- **`staff_details`**: Department, designation, employee ID, and notes linked 1-to-1 to `profiles`.
- **`activity_logs`**: Immutable audit logs capturing user actions, IP addresses, targets, and timestamps.
- **Automatic Linking Trigger**: When a user registers as a customer, `handle_new_user()` auto-links existing unassigned `customers` matching that email.
