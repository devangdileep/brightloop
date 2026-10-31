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

export const ADMIN_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/users", label: "User Management", icon: Users },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/dashboard/customers", label: "Customers", icon: Users },
      { href: "/dashboard/subscriptions", label: "Subscriptions", icon: Shapes },
      { href: "/dashboard/quotations", label: "Quotations", icon: FileText },
    ],
  },
  {
    label: "Financials",
    items: [
      { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
      { href: "/dashboard/payments", label: "Payments", icon: Wallet },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Catalog & Rules",
    items: [
      { href: "/dashboard/products", label: "Products", icon: Package },
      { href: "/dashboard/plans", label: "Subscription Plans", icon: Boxes },
      { href: "/dashboard/discounts", label: "Discounts", icon: Percent },
      { href: "/dashboard/taxes", label: "Taxes", icon: Tags },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const STAFF_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/staff/customers", label: "Customers", icon: Users },
      { href: "/staff/quotations", label: "Quotations", icon: FileText },
      { href: "/staff/subscriptions", label: "Subscriptions", icon: Shapes },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/staff/invoices", label: "Invoices", icon: Receipt },
      { href: "/staff/payments", label: "Payments", icon: Wallet },
      { href: "/staff/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/staff/settings", label: "My Profile", icon: Settings },
    ],
  },
];

export const PORTAL_NAV_GROUPS = [
  {
    label: "Self-Service",
    items: [
      { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/portal/plans", label: "Available Plans", icon: Boxes },
      { href: "/portal/subscriptions", label: "My Subscriptions", icon: Shapes },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/portal/invoices", label: "My Invoices", icon: Receipt },
      { href: "/portal/payments", label: "Payment History", icon: Wallet },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/portal/profile", label: "My Profile", icon: Settings },
    ],
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

export function getRoleHome(role: string | undefined): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "staff":
      return "/staff/dashboard";
    case "customer":
      return "/portal/dashboard";
    default:
      return "/portal/dashboard";
  }
}

