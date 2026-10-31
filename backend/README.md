# Brightloop — Backend API & Database

This directory contains the complete backend for **Brightloop Software Subscription Management System**:
1. **FastAPI REST API**: High-performance asynchronous backend connecting the frontend to Supabase.
2. **Supabase PostgreSQL Schema & RLS**: Normalized database schema, triggers, functions, and Zero-Trust Row-Level Security policies.
3. **Recurring Billing Engine**: Automated recurring billing engine with calendar-aware date arithmetic and idempotency protection.
4. **Render Deployment**: Configuration for zero-downtime deployment on Render.

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI application setup, CORS, error handling
│   ├── core/
│   │   ├── config.py               # Pydantic v2 settings & environment variables
│   │   ├── security.py             # Supabase Auth JWT validation & token caching
│   │   ├── permissions.py          # Role definitions (admin, staff, customer)
│   │   └── exceptions.py           # Centralized exception handling
│   ├── database/
│   │   └── supabase_client.py      # Request-scoped Supabase PostgREST client
│   ├── dependencies/
│   │   └── authentication.py       # Role-based dependency injection
│   ├── schemas/                    # Pydantic request & response schemas
│   ├── routers/                    # API v1 modular route handlers
│   ├── services/                   # Business logic (billing, invoices, PDFs, etc.)
│   ├── tasks/                      # Scheduled billing task runner
│   └── utils/                      # Calendar calculations, document numbering, pagination
├── supabase/
│   ├── migrations/
│   │   ├── 20261031000100_schema.sql  # Core schema, enums, triggers, functions
│   │   ├── 20261031000200_rls.sql     # Zero-trust RLS policies
│   │   └── 20261031000300_extensions.sql # Idempotency index & extended tables
│   ├── functions/generate-invoices/   # Supabase Edge function for billing
│   ├── seed.sql                       # Demo data
│   └── cron.sql                       # pg_cron daily schedule
├── tests/                          # Pytest suite with mock Supabase client
├── render.yaml                     # Render web service & cron deployment
├── requirements.txt                # Python dependencies
├── .env.example                    # Environment variable template
├── API.md                          # Comprehensive API route documentation
└── README.md
```

---

## Getting Started Locally

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
Fill in your `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optional `SUPABASE_SERVICE_ROLE_KEY`.

### 4. Run the API Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Open [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger documentation.

---

## Running Tests

The test suite runs with unit mocks for Supabase, validating token verification, role permissions, calendar date math, discount computations, duplicate invoice prevention, and recurring billing:

```bash
cd backend
source .venv/bin/activate
pytest -v
```

---

## Database Migrations

Apply migrations to your Supabase project:
```bash
cd backend
npx supabase db push
```
Or run the SQL migration files in sequence via the Supabase Dashboard SQL editor:
1. `supabase/migrations/20261031000100_schema.sql`
2. `supabase/migrations/20261031000200_rls.sql`
3. `supabase/migrations/20261031000300_extensions.sql`

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

