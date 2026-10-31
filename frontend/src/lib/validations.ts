import { z } from "zod";

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined || (typeof value === "number" && Number.isNaN(value)) ? null : value;
const optionalText = z.preprocess(emptyToNull, z.string().trim().nullable().optional());
const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().optional());
const optionalNumber = z.preprocess(emptyToNull, z.coerce.number().nullable().optional());
const checkbox = z.preprocess(
  (value) => value === true || value === "true" || value === "on" || value === "1",
  z.boolean()
);

export const authLoginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const strongPasswordSchema = z
  .string()
  .min(9, "Password must be more than 8 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character");

export const authRegisterSchema = z
  .object({
    full_name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email address"),
    password: strongPasswordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const customerSchema = z.object({
  name: z.string().min(2, "Customer name is required"),
  company: optionalText,
  contact_name: optionalText,
  email: z.string().email("Enter a valid email address"),
  phone: optionalText,
  country: optionalText,
  address: optionalText,
  tax_id: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
  notes: optionalText,
});

export const productSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  description: optionalText,
  category: optionalText,
  base_price: z.coerce.number().min(0, "Price cannot be negative"),
  is_active: checkbox.default(true),
});

export const planSchema = z.object({
  name: z.string().min(2, "Plan name is required"),
  description: optionalText,
  product_id: optionalUuid,
  price: z.coerce.number().min(0, "Price cannot be negative"),
  interval: z.enum(["monthly", "quarterly", "yearly"]),
  interval_count: z.coerce.number().int().min(1).max(36).default(1),
  trial_days: z.coerce.number().int().min(0).max(365).default(0),
  features: optionalText,
  is_active: checkbox.default(true),
});

export const subscriptionSchema = z.object({
  customer_id: z.string().uuid("Select a customer"),
  plan_id: z.string().uuid("Select a plan"),
  status: z.enum(["trialing", "active", "paused", "past_due", "canceled"]).default("active"),
  quantity: z.coerce.number().int().min(1).default(1),
  started_at: z.string().min(1, "Start date is required"),
  discount_id: optionalUuid,
  tax_id: optionalUuid,
  notes: optionalText,
});

export const discountSchema = z.object({
  code: z.string().min(2, "Code is required").toUpperCase(),
  description: optionalText,
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().min(0, "Value cannot be negative"),
  is_active: checkbox.default(true),
  valid_from: optionalText,
  valid_until: optionalText,
  max_redemptions: optionalNumber,
});

export const taxSchema = z.object({
  name: z.string().min(2, "Tax name is required"),
  rate: z.coerce.number().min(0, "Rate cannot be negative").max(100),
  country: optionalText,
  is_default: checkbox.default(false),
  is_active: checkbox.default(true),
});

export const paymentSchema = z.object({
  invoice_id: z.string().uuid("Select an invoice"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.enum(["card", "bank_transfer", "cash", "other"]),
  reference: optionalText,
  paid_at: z.string().min(1, "Payment date is required"),
  notes: optionalText,
});

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unit_price: z.coerce.number().min(0, "Price cannot be negative"),
});

const itemsField = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  },
  z.array(lineItemSchema).min(1, "Add at least one line item")
);

export const quotationSchema = z.object({
  customer_id: z.string().uuid("Select a customer"),
  issue_date: z.string().min(1),
  valid_until: z.string().min(1),
  discount_id: optionalUuid,
  tax_id: optionalUuid,
  notes: optionalText,
  terms: optionalText,
  items: itemsField,
});

export const invoiceSchema = z.object({
  customer_id: z.string().uuid("Select a customer"),
  subscription_id: optionalUuid,
  issue_date: z.string().min(1),
  due_date: z.string().min(1),
  discount_id: optionalUuid,
  tax_id: optionalUuid,
  notes: optionalText,
  items: itemsField,
});

export const profileSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  phone: optionalText,
});

export const createStaffSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: optionalText,
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
});

export const editStaffSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  phone: optionalText,
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
});

export const customerProfileSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  phone: optionalText,
  company_name: optionalText,
  billing_address: optionalText,
});

export const customerSelfSubscribeSchema = z.object({
  plan_id: z.string().uuid("Invalid plan"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").default(1),
});

export const settingsSchema = z.object({
  company_name: z.string().min(2, "Company name is required"),
  support_email: z.string().email("Enter a valid email address"),
  currency: z.string().min(3).max(3),
  invoice_prefix: z.string().min(2).max(10),
  invoice_due_days: z.coerce.number().int().min(0).max(365),
  default_tax_id: optionalUuid,
  address: optionalText,
});

export const formSchemas = {
  customer: customerSchema,
  product: productSchema,
  plan: planSchema,
  subscription: subscriptionSchema,
  discount: discountSchema,
  tax: taxSchema,
  payment: paymentSchema,
  profile: profileSchema,
  settings: settingsSchema,
  createStaff: createStaffSchema,
  editStaff: editStaffSchema,
  customerProfile: customerProfileSchema,
  customerSelfSubscribe: customerSelfSubscribeSchema,
} as const;

export type FormSchemaKey = keyof typeof formSchemas;
