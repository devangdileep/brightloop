# Brightloop API Documentation

The Brightloop Subscription Management REST API is built with **FastAPI**, **Pydantic v2**, and **Supabase Data API / PostgREST**.

- **Base URL Prefix:** `/api/v1`
- **Interactive Swagger Docs:** `/docs`
- **ReDoc Documentation:** `/redoc`
- **Health Check:** `GET /health` and `GET /api/v1/health`

---

## Authentication & Authorization

Protected endpoints require a standard Supabase Auth access token passed via the `Authorization` header:

```http
Authorization: Bearer <supabase_access_token>
```

The backend validates the token via Supabase Auth, determines the user's UUID, and fetches the authoritative application role from `public.profiles`.

### Roles
- `admin`: Full administrative access (products, plans, taxes, discounts, settings, staff invitations).
- `staff`: Operational access (customers, quotations, subscriptions, invoices, payments, reports, billing trigger).
- `customer`: Self-service portal access restricted strictly to their own linked profile, customer record, subscriptions, invoices, and payments.

---

## Endpoints Summary

### 1. Authentication & Profiles
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/me` | Authenticated | Retrieve authenticated user UUID, email, and database role |
| `GET` | `/api/v1/me/profile` | Authenticated | Retrieve the full profile of the authenticated user |
| `PUT` | `/api/v1/me/profile` | Authenticated | Update full name, phone number, avatar URL |
| `POST` | `/api/v1/auth/invite-staff` | Admin | Create/invite a new staff member account via Supabase Admin API |
| `GET` | `/api/v1/profiles` | Staff / Admin | List user profiles with pagination and role filter |
| `GET` | `/api/v1/profiles/{user_id}` | Authenticated (Self or Staff) | Get a user's profile |
| `PUT` | `/api/v1/profiles/{user_id}/role` | Admin | Change application role for a user (`admin`, `staff`, `customer`) |

### 2. Products & Variants
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/products` | Authenticated | List catalog products (filtered by active, category, search) |
| `GET` | `/api/v1/products/{id}` | Authenticated | Get product details including variants |
| `POST` | `/api/v1/products` | Admin | Create new product with optional inline variants |
| `PUT` | `/api/v1/products/{id}` | Admin | Update product details |
| `DELETE` | `/api/v1/products/{id}` | Admin | Deactivate (or hard-delete with `?hard_delete=true`) product |
| `GET` | `/api/v1/products/{id}/variants` | Authenticated | List all variants for a product |
| `POST` | `/api/v1/products/{id}/variants` | Admin | Add variant to product |
| `PUT` | `/api/v1/variants/{id}` | Admin | Update a variant |
| `DELETE` | `/api/v1/variants/{id}` | Admin | Deactivate or delete variant |

### 3. Plans
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/plans` | Authenticated | List subscription plans with pagination |
| `GET` | `/api/v1/plans/{id}` | Authenticated | Get plan details |
| `POST` | `/api/v1/plans` | Admin | Create plan (interval: `daily`, `weekly`, `monthly`, `quarterly`, `yearly`) |
| `PUT` | `/api/v1/plans/{id}` | Admin | Update plan details |
| `DELETE` | `/api/v1/plans/{id}` | Admin | Deactivate plan |

### 4. Customers
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/customers/me` | Authenticated | Get the customer record linked to current user |
| `GET` | `/api/v1/customers` | Authenticated (RLS) | List customers (Staff see all; customers see own) |
| `GET` | `/api/v1/customers/{id}` | Authenticated (Self or Staff) | Get customer details |
| `POST` | `/api/v1/customers` | Staff / Admin | Create new customer |
| `PUT` | `/api/v1/customers/{id}` | Staff / Admin | Update customer details |
| `GET` | `/api/v1/customers/{id}/subscriptions` | Authenticated (Self or Staff) | List subscriptions belonging to customer |
| `GET` | `/api/v1/customers/{id}/invoices` | Authenticated (Self or Staff) | List invoices belonging to customer |

### 5. Taxes
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/taxes/default` | Authenticated | Retrieve default tax configuration |
| `GET` | `/api/v1/taxes` | Authenticated | List tax rates |
| `GET` | `/api/v1/taxes/{id}` | Authenticated | Get tax details |
| `POST` | `/api/v1/taxes` | Admin | Create tax rate |
| `PUT` | `/api/v1/taxes/{id}` | Admin | Update tax rate |
| `DELETE` | `/api/v1/taxes/{id}` | Admin | Deactivate tax rate |

### 6. Discounts
| Method | Path | Role Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/discounts/validate` | Authenticated | Check coupon validity, date, usage limits, and compute discount amount |
| `GET` | `/api/v1/discounts` | Authenticated | List discounts |
| `GET` | `/api/v1/discounts/{id}` | Authenticated | Get discount details |
| `POST` | `/api/v1/discounts` | Admin | Create discount coupon |
| `PUT` | `/api/v1/discounts/{id}` | Admin | Update discount coupon |
| `DELETE` | `/api/v1/discounts/{id}` | Admin | Deactivate discount coupon |

### 7. Quotations & Quotation Templates
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/quotations` | Authenticated (RLS) | List quotations |
| `GET` | `/api/v1/quotations/{id}` | Authenticated (Self or Staff) | Get quotation details with line items |
| `POST` | `/api/v1/quotations` | Staff / Admin | Create quotation with calculated subtotal, discounts, and taxes |
| `POST` | `/api/v1/quotations/from-template` | Staff / Admin | Create quotation from saved template |
| `PUT` | `/api/v1/quotations/{id}/status` | Staff / Admin | Transition quotation status (`draft`, `sent`, `accepted`, `declined`, `expired`, `converted`) |
| `POST` | `/api/v1/quotations/{id}/convert` | Staff / Admin | Convert accepted quotation into an active/confirmed subscription |
| `POST` | `/api/v1/quotations/{id}/send` | Staff / Admin | Mark quotation as sent and dispatch email |
| `GET` | `/api/v1/quotation-templates` | Authenticated | List quotation templates |
| `GET` | `/api/v1/quotation-templates/{id}` | Authenticated | Get template details |
| `POST` | `/api/v1/quotation-templates` | Staff / Admin | Create quotation template |
| `PUT` | `/api/v1/quotation-templates/{id}` | Staff / Admin | Update quotation template |

### 8. Subscriptions
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/subscriptions` | Authenticated (RLS) | List subscriptions |
| `GET` | `/api/v1/subscriptions/{id}` | Authenticated (Self or Staff) | Get subscription details with lines |
| `POST` | `/api/v1/subscriptions` | Staff / Admin | Create subscription with automated billing period calculation |
| `PUT` | `/api/v1/subscriptions/{id}` | Staff / Admin | Update subscription quantity or metadata |
| `POST` | `/api/v1/subscriptions/{id}/pause` | Staff / Admin | Pause subscription |
| `POST` | `/api/v1/subscriptions/{id}/resume` | Authenticated (Self or Staff) | Resume paused subscription |
| `POST` | `/api/v1/subscriptions/{id}/cancel` | Authenticated (Self or Staff) | Cancel subscription (immediate for staff, at period end for customer) |
| `POST` | `/api/v1/subscriptions/{id}/close` | Staff / Admin | Close subscription |
| `POST` | `/api/v1/subscriptions/{id}/renew` | Staff / Admin | Renew expired or closed subscription |
| `GET` | `/api/v1/subscriptions/{id}/events` | Authenticated (Self or Staff) | Retrieve lifecycle event history |

### 9. Invoices
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/invoices` | Authenticated (RLS) | List invoices |
| `GET` | `/api/v1/invoices/{id}` | Authenticated (Self or Staff) | Get invoice details, items, balance |
| `GET` | `/api/v1/invoices/{id}/items` | Authenticated (Self or Staff) | Get invoice line items |
| `POST` | `/api/v1/invoices` | Staff / Admin | Create manual invoice |
| `POST` | `/api/v1/invoices/generate/{sub_id}` | Staff / Admin | Generate invoice for subscription current period (idempotent) |
| `POST` | `/api/v1/invoices/{id}/confirm` | Staff / Admin | Confirm draft invoice to open status |
| `POST` | `/api/v1/invoices/{id}/cancel` | Staff / Admin | Void / cancel open invoice |
| `GET` | `/api/v1/invoices/{id}/pdf` | Authenticated (Self or Staff) | Stream or download invoice PDF |
| `POST` | `/api/v1/invoices/{id}/send` | Staff / Admin | Dispatch invoice to customer email |

### 10. Payments
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/payments` | Authenticated (RLS) | List payments |
| `GET` | `/api/v1/payments/{id}` | Authenticated (Self or Staff) | Get payment details |
| `POST` | `/api/v1/payments` | Staff / Admin | Record payment (validates balance, prevents duplicate references, returns updated invoice) |
| `GET` | `/api/v1/payments/invoice/{id}` | Authenticated (Self or Staff) | List payments for specific invoice |
| `GET` | `/api/v1/payments/customer/{id}` | Authenticated (Self or Staff) | List payments for specific customer |

### 11. Recurring Billing Engine
| Method | Path | Role Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/billing/run` | Staff / Admin OR `Bearer BILLING_CRON_SECRET` | Execute recurring billing cycle for subscriptions due |

### 12. Dashboard & Reports
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/dashboard/metrics` | Staff / Admin | High-level metrics: active subscriptions, overdue counts, revenues, recent transactions |
| `GET` | `/api/v1/reports/revenue` | Staff / Admin | Date-filtered revenue and invoiced volume report |

### 13. Workspace Settings
| Method | Path | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/settings` | Authenticated | Retrieve company settings and default invoice terms |
| `PUT` | `/api/v1/settings` | Admin | Update company name, logo, currency, default due days |
