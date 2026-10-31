import {
  BarChart3,
  Boxes,
  FileText,
  LayoutDashboard,
  Package,
  Percent,
  Receipt,
  Settings,
  Shapes,
  Tags,
  Users,
  Wallet,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["admin", "staff"] },
  { href: "/dashboard/portal", label: "My account", icon: LayoutDashboard, roles: ["customer"] },
  { href: "/dashboard/customers", label: "Customers", icon: Users, roles: ["admin", "staff"] },
  { href: "/dashboard/products", label: "Products", icon: Package, roles: ["admin", "staff"] },
  { href: "/dashboard/plans", label: "Subscription Plans", icon: Boxes, roles: ["admin", "staff"] },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: Shapes, roles: ["admin", "staff"] },
  { href: "/dashboard/quotations", label: "Quotations", icon: FileText, roles: ["admin", "staff"] },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt, roles: ["admin", "staff", "customer"] },
  { href: "/dashboard/payments", label: "Payments", icon: Wallet, roles: ["admin", "staff", "customer"] },
  { href: "/dashboard/discounts", label: "Discounts", icon: Percent, roles: ["admin"] },
  { href: "/dashboard/taxes", label: "Taxes", icon: Tags, roles: ["admin"] },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["admin", "staff"] },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["admin", "staff", "customer"] },
];

export const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [NAV_ITEMS[0], NAV_ITEMS[1]],
  },
  {
    label: "Customers",
    items: [NAV_ITEMS[2], NAV_ITEMS[4], NAV_ITEMS[5]],
  },
  {
    label: "Revenue",
    items: [NAV_ITEMS[6], NAV_ITEMS[7], NAV_ITEMS[8]],
  },
  {
    label: "Catalog",
    items: [NAV_ITEMS[3], NAV_ITEMS[9], NAV_ITEMS[10]],
  },
  {
    label: "Insights",
    items: [NAV_ITEMS[11], NAV_ITEMS[12]],
  },
];

export const INVOICE_STATUSES = ["draft", "open", "paid", "void", "uncollectible"] as const;
export const SUBSCRIPTION_STATUSES = ["trialing", "active", "paused", "past_due", "canceled"] as const;
export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "declined", "expired"] as const;
export const PAYMENT_METHODS = ["card", "bank_transfer", "cash", "other"] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  staff: "Staff",
  customer: "Customer",
};

export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
];
