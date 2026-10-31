# Brightloop — Backend API & Supabase Infrastructure

This directory contains the complete backend for the **Brightloop Software Subscription Management System**:
1. **FastAPI REST API**: High-performance asynchronous REST backend connecting the Next.js frontend to Supabase.
2. **Supabase PostgreSQL Schema & RLS**: Normalized database schema, triggers, functions, user management, and Zero-Trust Row-Level Security policies.
3. **Recurring Billing Engine**: Automated recurring billing engine with calendar-aware date arithmetic and idempotency protection.
4. **Edge Functions & Cron**: Supabase Edge Functions and pg_cron configuration for automated daily billing runs.
5. **Render Deployment**: Configuration for zero-downtime deployment on Render (`render.yaml`).

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                                # FastAPI application setup, CORS, error handling
│   ├── core/
│   │   ├── config.py                          # Pydantic v2 settings & environment variables
│   │   ├── security.py                        # Supabase Auth JWT validation & token caching
│   │   ├── permissions.py                     # Role definitions (admin, staff, customer)
│   │   └── exceptions.py                      # Centralized exception handling
│   ├── database/
│   │   └── supabase_client.py                 # Request-scoped Supabase PostgREST client
│   ├── dependencies/
│   │   └── authentication.py                  # Role-based dependency injection
│   ├── schemas/                               # Pydantic request & response schemas
│   ├── routers/                               # API v1 modular route handlers (82 endpoints)
│   ├── services/                              # Business logic (billing, invoices, PDFs, etc.)
│   ├── tasks/                                 # Scheduled billing task runner
│   └── utils/                                 # Calendar calculations, document numbering, pagination
├── supabase/
│   ├── migrations/
│   │   ├── 20261031000100_schema.sql          # Normalized PostgreSQL schema, functions, triggers
│   │   ├── 20261031000200_rls.sql             # Zero-trust Row-Level Security (RLS) policies
│   │   ├── 20261031000300_extensions.sql      # Idempotency index & extended subscription/invoice schema
│   │   └── 20261031000400_user_management.sql # User Management: staff_details, activity_logs, status & triggers
│   ├── functions/
│   │   └── generate-invoices/                 # Edge Function for idempotent recurring billing
│   │       └── index.ts
│   ├── seed.sql                               # Realistic demo seed data (Indian SaaS context, ₹ INR)
│   ├── cron.sql                               # pg_cron scheduled job invoking generate-invoices daily
│   ├── verify.sql                             # Health check queries to verify setup & RLS
│   └── config.toml                            # Supabase CLI configuration
├── tests/                                     # Pytest test suite with mock Supabase client
├── render.yaml                                # Render web service & cron deployment specification
├── requirements.txt                           # Python dependencies
├── .env.example                               # Backend environment template
├── API.md                                     # Comprehensive API route documentation
└── README.md                                  # Documentation
```

---

## Getting Started Locally (FastAPI)

### 1. Requirements
- Python 3.12+ (or 3.14+)
- Virtual environment (`venv` or `uv`)

### 2. Setup Virtual Environment
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your environment variables:
- `SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
- `SUPABASE_ANON_KEY`: Your project's anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY`: Your project's service role key (for privileged operations)
- `BILLING_CRON_SECRET`: Secret token for billing endpoint authorization

### 4. Run the API Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Open [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger documentation, or [http://localhost:8000/redoc](http://localhost:8000/redoc) for ReDoc.

---

## Running Tests

The test suite runs with unit mocks for Supabase, validating token verification, role permissions, calendar date math, discount computations, duplicate invoice prevention, and recurring billing:

```bash
cd backend
source .venv/bin/activate
pytest -v
```

---

## Database Setup & Migrations (Supabase)

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
3. `supabase/migrations/20261031000300_extensions.sql`
4. `supabase/migrations/20261031000400_user_management.sql`

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

---

## Deployment on Render

This project includes a `render.yaml` specification for deploying both the FastAPI web service and the daily billing cron runner.

### Render Configuration
1. Connect your GitHub repository to Render.
2. Render detects `backend/render.yaml` automatically.
3. Configure environment variables in the Render Dashboard:
   - `SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
   - `SUPABASE_PUBLISHABLE_KEY`: Your project's anon/publishable key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your project's service-role key (used only for background billing and staff creation)
   - `FRONTEND_ORIGIN`: URL of the Next.js frontend (e.g., `https://brightloop.onrender.com` or `http://localhost:3000`)
   - `BILLING_CRON_SECRET`: Random secret key used to authenticate recurring billing triggers

Health check endpoint: `/health`.
API documentation is available at `/docs`.

---

## Known Limitations

1. **Frontend Invoice Selection on Payments Page**:
   - The Payments page (`frontend/src/app/dashboard/payments/page.tsx:24`) queries invoices strictly with `.eq("status", "open")`.
   - Invoices that have partial payments recorded transition to `partially_paid` in the database. Consequently, they do not appear in this specific dropdown on `/dashboard/payments`.
   - *Workaround*: Staff and customers can record additional partial payments directly on the Invoice Detail page (`/dashboard/invoices/[id]`), which permits payment recording whenever `balance > 0 && status !== 'void'`.
2. **Pre-Existing Duplicate Period Resolution Requirement**:
   - Migration `20261031000300_extensions.sql` includes an idempotency pre-check that halts execution if duplicate billing period invoices already exist for a subscription. Duplicate records must be deduplicated before applying the unique index constraint.
3. **Automated Event Origin Attribution**:
   - Scheduled recurring billing runs executed by the backend worker using `BILLING_CRON_SECRET` run under the service role without an interactive user JWT (`auth.uid() = NULL`). Corresponding subscription audit event rows will record `created_by = NULL`.
4. **Single Base Currency per Organization**:
   - Invoices and settings support configurable currency codes (default `'USD'`), but multi-currency conversions within a single invoice or payment are not handled by the database schema.
