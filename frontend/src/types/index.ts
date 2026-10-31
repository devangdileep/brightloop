export type UserRole = "admin" | "staff" | "customer";
export type BillingInterval = "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "trialing" | "active" | "paused" | "past_due" | "canceled";
export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";
export type QuotationStatus = "draft" | "sent" | "accepted" | "declined" | "expired";
export type PaymentMethod = "card" | "bank_transfer" | "cash" | "other";
export type DiscountType = "percentage" | "fixed";

export type UserStatus = "active" | "inactive" | "suspended";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status?: UserStatus;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
}

export interface StaffDetail {
  id: string;
  user_id: string;
  department: string | null;
  designation: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  created_at: string;
  user?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface Customer {
  id: string;
  user_id: string | null;
  name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  company_name?: string | null;
  country: string | null;
  address: string | null;
  billing_address?: string | null;
  tax_id: string | null;
  status: "active" | "inactive";
  customer_status?: "active" | "inactive";
  notes: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  is_active: boolean;
  created_at: string;
}

export interface Plan {
  id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  price: number;
  interval: BillingInterval;
  interval_count: number;
  trial_days: number;
  features: string[] | null;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  quantity: number;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  discount_id: string | null;
  tax_id: string | null;
  notes: string | null;
  created_at: string;
  customer?: Pick<Customer, "id" | "name" | "email">;
  plan?: Pick<Plan, "id" | "name" | "price" | "interval" | "interval_count">;
}

export interface Quotation {
  id: string;
  number: string;
  customer_id: string;
  status: QuotationStatus;
  issue_date: string;
  valid_until: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  notes: string | null;
  terms: string | null;
  created_by: string | null;
  created_at: string;
  customer?: Pick<Customer, "id" | "name" | "email">;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
}

export interface Invoice {
  id: string;
  number: string;
  customer_id: string;
  subscription_id: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  period_start: string | null;
  period_end: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  currency: string;
  notes: string | null;
  pdf_path: string | null;
  created_by: string | null;
  created_at: string;
  customer?: Pick<Customer, "id" | "name" | "email" | "address" | "tax_id">;
  subscription?: Pick<Subscription, "id" | "status"> | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
}

export interface Payment {
  id: string;
  invoice_id: string | null;
  customer_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  customer?: Pick<Customer, "id" | "name">;
  invoice?: Pick<Invoice, "id" | "number"> | null;
}

export interface Discount {
  id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  value: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  created_at: string;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  country: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AppSettings {
  id: number;
  company_name: string;
  support_email: string;
  currency: string;
  invoice_prefix: string;
  invoice_due_days: number;
  default_tax_id: string | null;
  address: string | null;
  logo_url: string | null;
  updated_at: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  id?: string;
}
