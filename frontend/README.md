# Brightloop

A complete subscription-management platform for a fictional SaaS company, **Brightloop Software**. It covers the full recurring-revenue lifecycle: customers, products, plans, subscriptions, quotations, recurring billing, invoices, payments, discounts, taxes and revenue analytics — with a separate self-service portal for customers.

Built with the Next.js App Router and Supabase. Every table is protected by Row Level Security, and privileged operations run on the server only.

---

## Contents

- [What's included](#whats-included)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
  - [1. Install dependencies](#1-install-dependencies)
  - [2. Create a Supabase project](#2-create-a-supabase-project)
  - [3. Configure environment variables](#3-configure-environment-variables)
  - [4. Apply the database schema](#4-apply-the-database-schema)
  - [5. Seed demo data](#5-seed-demo-data)
  - [6. Configure authentication](#6-configure-authentication)
  - [7. Create your admin account](#7-create-your-admin-account)
  - [8. Run the app](#8-run-the-app)
- [Roles and access](#roles-and-access)
- [Demo walkthrough](#demo-walkthrough)
- [Recurring billing automation](#recurring-billing-automation)
- [Invoice PDFs and storage](#invoice-pdfs-and-storage)
- [CSV exports](#csv-exports)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## What's included

| Module | Capabilities |
| --- | --- |
| **Overview** | MRR, ARR, active subscriptions, outstanding balance, collection rate, revenue trend, recent activity, upcoming renewals |
| **Customers** | Search, sort, paginate, create/edit, activate/deactivate, company and tax details, portal invitations |
| **Products** | Catalog CRUD, category and base price, active/inactive toggles (admin-only writes) |
| **Subscription Plans** | Plans attached to products, monthly/quarterly/yearly intervals, trial days, feature lists, active toggles |
| **Subscriptions** | Create subscriptions from a plan, quantities, trials, discounts and taxes, pause/resume/cancel, generate an invoice on demand, renewal tracking |
| **Quotations** | Line-item builder, discount and tax calculation, draft → sent → accepted/declined lifecycle, convert accepted quotes manually into subscriptions |
| **Invoices** | One-off and recurring invoices, atomic per-year numbering, status transitions (draft/open/paid/void/uncollectible), line items, PDF download |
| **Payments** | Record card / bank transfer / cash / other payments, automatic invoice balance updates, overpayment protection |
| **Discounts** | Percentage or fixed-amount codes, validity windows, redemption caps, active toggles |
| **Taxes** | Per-country rates, default tax, active toggles |
| **Reports** | Twelve-month revenue and invoice analytics, MRR movement, plan mix, top customers, status breakdown, CSV exports |
| **Settings** | Company profile, invoice defaults, team roles, portal invitations, workspace overview |
| **Customer portal** | `/dashboard/portal` — own subscriptions, invoices, payments and PDF downloads; self-service cancel/resume |

Plus: light-first premium UI with dark mode, collapsible sidebar, mobile drawer, command palette (`⌘K` / `Ctrl+K`), toasts, skeleton/loading states, empty states and keyboard-accessible dialogs.

---

## Tech stack

- **Next.js 16** (App Router, React Server Components, Server Actions, Proxy)
- **React 19** and **TypeScript**
- **Tailwind CSS v4** with hand-written shadcn/ui-style primitives on Radix UI
- **Supabase**: PostgreSQL, Auth, Row Level Security, Storage, Edge Functions, Cron
- **Zod** + **React Hook Form** for validation
- **TanStack Table** for data grids
- **Recharts** for analytics
- **pdf-lib** for server-side invoice PDFs
- **date-fns**, **Lucide React**, **Sonner**, **next-themes**

---

## Architecture

```
Browser ──► Next.js App Router (RSC + Server Actions) ──► Supabase (Postgres + RLS)
   │                    │
   │                    ├─► Supabase Auth (cookie session, refreshed in proxy.ts)
   │                    ├─► Supabase Storage (private `documents` bucket)
   │                    └─► Edge Function `generate-invoices` (cron)
   └── anon key only
```

- **Reads** happen in Server Components using the user's session, so RLS decides what is visible.
- **Writes** go through Server Actions that re-check the user's role before touching the database.
- **Service-role key** is used only inside server-side actions for Auth admin operations (inviting portal users and team members) and is never shipped to the browser.
- **Billing logic** lives in `src/lib/billing.ts` and is mirrored in the `generate-invoices` Edge Function so the same rules apply whether billing is triggered from the UI or from cron.
- **Invoice numbering** uses the Postgres function `next_document_number()` with an atomic per-year counter. It rejects non-staff callers.

---

## Prerequisites

- Node.js 20 or newer (Node 22 recommended)
- npm
- A Supabase project (free tier is fine)
- Optional: [Supabase CLI](https://supabase.com/docs/guides/cli) for `db push`, function deploys and local development

> Docker is **not** required if you use a hosted Supabase project. This guide assumes the hosted path.

### Optional: local Supabase (requires Docker)

If you have Docker, the CLI can run the whole stack locally:

```bash
npx supabase start          # prints local API URL, anon key and service_role key
npx supabase db reset       # applies both migrations and supabase/seed.sql
```

Then point `.env.local` at the printed local URL and keys (`http://127.0.0.1:54321`). Stop it with `npx supabase stop`.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [database.new](https://database.new) and create a project.
2. Wait for provisioning to finish.
3. Open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose this)

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Notes:

- `NEXT_PUBLIC_SITE_URL` is used in auth redirect links (invitations and password resets). Set it to your deployed URL in production.
- Without `SUPABASE_SERVICE_ROLE_KEY`, the app still works, but team invitations and customer portal invitations are disabled with a clear error message.
- Never prefix the service-role key with `NEXT_PUBLIC_`.

### 4. Apply the database schema

Two migrations create the schema and RLS policies:

```
supabase/migrations/20261031000100_schema.sql
supabase/migrations/20261031000200_rls.sql
```

**Option A — Supabase CLI (recommended)**

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`db push` prompts for the database password you set when creating the project.

**Option B — SQL editor**

In the Supabase dashboard, open **SQL Editor** and run the migration files **in order**, pasting the full contents of each:

1. `20261031000100_schema.sql`
2. `20261031000200_rls.sql`

The RLS migration also creates the private `documents` storage bucket and its policies, so no manual bucket setup is needed.

Verify:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- every table should show rowsecurity = true
```

Or run the full check script `supabase/verify.sql` in the SQL Editor. It reports RLS coverage, policy count, table set, storage bucket and document-numbering function.

### 5. Seed demo data

The seed creates 8 customers, 6 products, 6 plans, 12 subscriptions, 5 quotations, six months of invoice history, payments, taxes and discounts.

**Option A — SQL editor**

Paste `supabase/seed.sql` into the SQL Editor and run it.

**Option B — psql**

```bash
psql "postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" -f supabase/seed.sql
```

The seed is idempotent for reference data (customers, products, plans, taxes, discounts, subscriptions, quotations). Billing history is generated only when the `invoices` table is empty.

> Supabase's SQL editor runs scripts in a single transaction. If your project already has data and a statement conflicts, the whole seed rolls back.

### 6. Configure authentication

In **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (use your production URL when deployed)
- **Redirect URLs**: add both
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`

For a quick local demo, **Authentication → Providers → Email**:

- Keep **Enable email provider** on.
- Turn **Confirm email** off so new accounts can sign in immediately.
- If you keep confirmations on, emails redirect through `/auth/confirm` and require the redirect URLs above.

Password reset uses `/auth/callback?next=/reset-password`; invitations use `/auth/callback?next=/dashboard/portal`.

### 7. Create your admin account

Registration always creates a **customer** account by design. Promote yourself after registering:

1. Start the app (`npm run dev`) and register at `/register`.
2. In the Supabase SQL Editor run:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

3. Sign out and back in (or refresh) — the sidebar switches to the staff/admin workspace.

To create additional staff accounts, invite them from **Settings → Team & roles** or change their role:

```sql
update public.profiles set role = 'staff' where email = 'teammate@example.com';
```

### 8. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If the app shows a **Connect Supabase to get started** screen, the environment variables are missing or the server has not been restarted since you added them.

---

## Roles and access

| Capability | Admin | Staff | Customer |
| --- | :---: | :---: | :---: |
| Overview, customers, products, plans, subscriptions, quotations, reports | ✅ | ✅ | — |
| Create/edit customers, subscriptions, quotations, invoices, payments | ✅ | ✅ | — |
| Products, plans, discounts, taxes | ✅ | read-only | — |
| Settings, team roles, payment deletion | ✅ | — | — |
| Own subscriptions, invoices, payments, PDF downloads | ✅ | ✅ | ✅ |
| Cancel/resume own subscription | — | — | ✅ |

Enforcement happens twice: UI navigation/actions hide what a role cannot do, and PostgreSQL RLS plus Server Action role checks reject it anyway. Staff can create and manage customers, subscriptions, quotations, invoices and payments, and can read the admin-managed catalog; catalog edits, finance configuration, team roles and payment deletion are admin-only.

Customers never see other customers' data. Their access is anchored on `customers.user_id = auth.uid()`.

### Customer portal invitations

1. As a staff member or admin, open **Customers → [customer]**.
2. Click **Invite to portal**. This uses the service-role key on the server to send a Supabase invite email and links `customers.user_id`.
3. The invited user sets a password and lands on `/dashboard/portal`.

If the button reports that the service-role key is missing, add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and restart the server.

---

## Demo walkthrough

After seeding and promoting your account:

1. **Overview** — inspect MRR/ARR, collection rate, revenue trend and upcoming renewals.
2. **Subscriptions** — open *Acme Corp · Growth* and try pause/resume, edit quantity, or **Generate invoice**.
3. **Invoices** — open an invoice, download the PDF, record a payment, or mark it paid.
4. **Quotations** — create a quotation with line items, mark it **sent**, then **accepted**. Convert it by creating a subscription for the same customer and plan.
5. **Reports** — review revenue by month, plan mix and top customers; export invoices/payments as CSV.
6. **Settings** — update company details and invoice defaults; invite a teammate under **Team & roles**.
7. **Customer portal** — invite a seeded customer (e.g. `billing@acme.com`), accept the invite in a private window, and verify they only see their own subscriptions, invoices and payments.

Billing automation can be exercised without waiting for cron: **Subscriptions → Run billing** creates invoices for every active subscription whose period has ended.

---

## Recurring billing automation

### How it works

- A subscription becomes billable when `current_period_end <= today` and its status is `active`, `past_due` or `trialing`.
- One invoice is created per subscription per period. Re-running billing is safe: an existing invoice for the same subscription and period is reused instead of duplicated.
- Discounts and tax rates are snapshotted onto the invoice. `cancel_at_period_end` subscriptions are canceled instead of renewed.
- After invoicing, the period advances by the plan interval (monthly, quarterly or yearly).
- Invoices are due according to **Settings → Invoice due days** (default 14).

### Trigger from the UI

Staff and admins can click **Run billing** on the Subscriptions page. This calls the same shared logic as cron (`src/lib/billing.ts`).

### Deploy the Edge Function

```bash
npx supabase functions deploy generate-invoices --no-verify-jwt
```

`--no-verify-jwt` is required because the scheduler authenticates with a shared secret instead of a user JWT.

Set the secret (optional but recommended):

```bash
npx supabase secrets set BILLING_CRON_SECRET=generate-a-long-random-string
```

The function also accepts the service-role key as a bearer token, which is what the Supabase dashboard "Invoke function" button sends.

Test it:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-invoices" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response includes `created`, `skipped`, `errors` and the created invoice numbers.

### Schedule it with Supabase Cron

`supabase/cron.sql` is a ready-to-edit template. Replace `YOUR_PROJECT_REF` and `YOUR_CRON_SECRET`, then run it in the SQL Editor:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'brightloop-generate-invoices',
  '15 2 * * *', -- daily at 02:15 UTC
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
```

Inspect runs with:

```sql
select * from cron.job_run_details order by start_time desc limit 20;
```

To remove the schedule:

```sql
select cron.unschedule('brightloop-generate-invoices');
```

---

## Invoice PDFs and storage

- The private `documents` bucket is created by the RLS migration.
- PDFs are generated on demand at `GET /api/invoices/[id]/pdf` using `pdf-lib`.
- They are stored at `invoices/{customer_id}/{invoice_id}.pdf` and `invoices.pdf_path` is updated when a staff user downloads the PDF.
- Staff can read/write all documents; customers can read only documents under their own customer folder, and only while `customers.user_id = auth.uid()`.
- Customers downloading their own invoice do not trigger an upload or an invoice update; the PDF is streamed directly and the storage write is skipped.

To inspect stored files:

```sql
select name, bucket_id, created_at from storage.objects where bucket_id = 'documents' order by created_at desc;
```

---

## CSV exports

Authenticated users can export CSV directly from list pages and Reports:

| Endpoint | Contents |
| --- | --- |
| `/api/export/customers` | Customer directory with status and contact fields |
| `/api/export/invoices` | Invoice register with totals and balances |
| `/api/export/payments` | Payment history |
| `/api/export/subscriptions` | Subscription roster (endpoint available; link it wherever you need it) |

RLS applies to exports too — the endpoints use the caller's session, not the service-role key.

---

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build (type-checks and lints)
npm start        # serve the production build
npm run lint     # ESLint
npx tsc --noEmit # standalone type check
```

Supabase helpers:

```bash
npx supabase db push                                  # apply migrations
npx supabase functions deploy generate-invoices --no-verify-jwt
npx supabase secrets set BILLING_CRON_SECRET=...
# Function logs: Supabase Dashboard → Edge Functions → generate-invoices → Logs
```

---

## Project structure

```
brightloop/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/                  # login, register, verify, forgot/reset password
│  │  ├─ api/
│  │  │  ├─ export/[resource]/    # CSV exports
│  │  │  └─ invoices/[id]/pdf/    # invoice PDF generation
│  │  ├─ auth/                    # callback + OTP confirm routes
│  │  ├─ dashboard/               # staff workspace + customer portal
│  │  └─ page.tsx                 # marketing landing page
│  ├─ components/                 # UI primitives, data table, forms, layout
│  ├─ lib/
│  │  ├─ actions/                 # Server Actions (auth, catalog, finance, billing…)
│  │  ├─ supabase/                # browser/server/admin clients + proxy session refresh
│  │  ├─ auth.ts                  # requireProfile / requireStaff / requireAdmin
│  │  ├─ billing.ts               # shared recurring billing engine
│  │  ├─ constants.ts             # navigation, enum options
│  │  ├─ utils.ts                 # formatting, date/interval helpers
│  │  └─ validations.ts           # Zod schemas
│  ├─ types/
│  └─ proxy.ts                    # Next.js 16 proxy (session refresh + route guards)
├─ supabase/
│  ├─ migrations/                 # schema + RLS/storage policies
│  ├─ functions/generate-invoices # scheduled billing Edge Function
│  ├─ cron.sql                    # pg_cron + pg_net template
│  ├─ seed.sql                    # demo data
│  ├─ verify.sql                  # installation checks
│  └─ config.toml                 # local Supabase CLI config
└─ .env.example
```

---

## Security notes

- **RLS is the source of truth.** Every public table is deny-by-default. Policies use `auth.uid()` and security-definer helpers (`is_staff()`, `is_admin()`).
- **Registration cannot escalate privileges.** The `handle_new_user()` trigger always creates a `customer` profile.
- **Role changes are admin-only** and admins cannot change their own role.
- **Portal users** are linked server-side with the Auth admin API; the service-role key never reaches client code.
- **Document numbers** are allocated by `next_document_number()`, which raises an exception for authenticated non-staff callers.
- **PDF route** re-checks the caller's role before writing to storage or updating `invoices.pdf_path`.
- **Exports** run under the caller's session and RLS.
- If a policy ever looks too broad, test with two accounts: one staff account and one portal account.

---

## Troubleshooting

**"Connect Supabase to get started" screen**
Environment variables are missing. Create `.env.local` from `.env.example` and restart `npm run dev`.

**Login succeeds but the dashboard redirects back to `/login`**
The session cookie is not being read. Check that `src/proxy.ts` is present and exports `proxy()`; it refreshes the Supabase session cookie on navigation.

**New user sees the customer portal instead of the staff workspace**
Expected. Promote the account with `update public.profiles set role = 'admin' ...` and sign in again.

**Invitations fail**
Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and restart. In hosted projects, make sure the key is the **service_role** key, not the anon key.

**`supabase db push` asks for a password / connection fails**
Use the database password from project creation, or run the SQL files directly in the SQL Editor.

**`relation "public.profiles" does not exist`**
The migrations have not been applied, or only the RLS migration was run. Run `20261031000100_schema.sql` first.

**Billing creates no invoices**
Check that subscriptions are `active`/`past_due`/`trialing`, `current_period_end` is today or earlier, and the plan reference exists. Run **Subscriptions → Run billing** to see counts and errors.

**PDF download returns 404**
The invoice is not visible to the current user (RLS) or the ID is wrong. Staff can see all invoices; customers only their own.

**Cron runs but nothing happens**
Confirm the function URL, the `BILLING_CRON_SECRET` value in both the function secrets and the cron SQL, and inspect `cron.job_run_details` plus the function logs in **Dashboard → Edge Functions → generate-invoices → Logs**.

**Emails are not delivered**
Supabase's built-in email sender is rate-limited. For demos, disable email confirmation or configure a custom SMTP provider under **Authentication → Emails**.

---

## Disclaimer

Brightloop Software is a fictional company created for this demonstration. All customers, invoices, payments and email addresses in the seed data are fictional.
