import { Boxes, CircleDollarSign, Clock, Sparkles } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { savePlan } from "@/lib/actions/catalog";
import { formatCurrency, intervalLabel, monthlyValue } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { CreateDialog } from "@/components/create-dialog";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import type { FieldDef } from "@/components/resource-form";

export default async function PlansPage() {
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";

  const [plansRes, productsRes] = await Promise.all([
    supabase
      .from("plans")
      .select("*, product:products(name), subscriptions(count)")
      .order("price", { ascending: true }),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
  ]);

  const plans = (plansRes.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    description: string | null;
    product_id: string | null;
    price: number;
    interval: string;
    interval_count: number;
    trial_days: number;
    features: string[] | null;
    is_active: boolean;
    product: { name: string } | null;
    subscriptions: { count: number }[];
  }>;

  const productOptions = ((productsRes.data ?? []) as unknown as Array<{ id: string; name: string }>).map((product) => ({
    value: product.id,
    label: product.name,
  }));

  const planFields: FieldDef[] = [
    { name: "name", label: "Plan name", placeholder: "Growth", required: true },
    { name: "product_id", label: "Product", type: "select", options: productOptions, placeholder: "Optional product" },
    { name: "price", label: "Price", type: "number", step: "0.01", min: 0, placeholder: "0.00", required: true },
    {
      name: "interval",
      label: "Billing interval",
      type: "select",
      options: [
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
        { value: "yearly", label: "Yearly" },
      ],
      defaultValue: "monthly",
    },
    { name: "interval_count", label: "Every N intervals", type: "number", min: 1, defaultValue: 1 },
    { name: "trial_days", label: "Trial days", type: "number", min: 0, defaultValue: 0 },
    { name: "is_active", label: "Active", type: "checkbox", description: "Available for new subscriptions", defaultValue: true },
    { name: "description", label: "Description", type: "textarea", placeholder: "Who is this plan for?" },
    {
      name: "features",
      label: "Features",
      type: "textarea",
      placeholder: "Comma-separated: Up to 25 seats, Unlimited workflows, Priority support",
      description: "Separate features with commas or new lines.",
    },
  ];

  const activePlans = plans.filter((plan) => plan.is_active);
  const mrrPotential = activePlans.reduce((sum, plan) => sum + monthlyValue(Number(plan.price), plan.interval, plan.interval_count), 0);
  const subscriptionCount = plans.reduce((sum, plan) => sum + (plan.subscriptions?.[0]?.count ?? 0), 0);

  const rows: TableRowData[] = plans.map((plan) => ({
    id: plan.id,
    _edit: {
      id: plan.id,
      name: plan.name,
      product_id: plan.product_id ?? "",
      price: Number(plan.price),
      interval: plan.interval,
      interval_count: plan.interval_count,
      trial_days: plan.trial_days,
      description: plan.description ?? "",
      features: (plan.features ?? []).join(", "),
      is_active: plan.is_active,
    },
    _actions: isAdmin
      ? [
          {
            label: plan.is_active ? "Archive plan" : "Activate plan",
            action: "plan.toggle",
            confirm: plan.is_active
              ? "Archived plans cannot be selected for new subscriptions. Existing subscriptions continue."
              : "Make this plan available for new subscriptions.",
            destructive: plan.is_active,
          },
        ]
      : [],
    name: plan.name,
    product: plan.product?.name ?? "—",
    price: Number(plan.price),
    interval: intervalLabel(plan.interval, plan.interval_count),
    trial: plan.trial_days > 0 ? `${plan.trial_days} days` : "None",
    subscriptions: plan.subscriptions?.[0]?.count ?? 0,
    status: plan.is_active ? "active" : "inactive",
  }));

  const columns: TableColumn[] = [
    { key: "name", header: "Plan", kind: "entity", subKey: "product" },
    { key: "price", header: "Price", kind: "currency", align: "right" },
    { key: "interval", header: "Billing" },
    { key: "trial", header: "Trial" },
    { key: "subscriptions", header: "Subs", kind: "number", align: "right" },
    { key: "status", header: "Status", kind: "badge" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription plans"
        description="Pricing, intervals and trials for recurring offerings."
        actions={
          isAdmin ? (
            <CreateDialog
              label="New plan"
              title="Create plan"
              description="Plans define the price and cadence used for recurring invoices."
              action={savePlan}
              schemaKey="plan"
              fields={planFields}
            />
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Plans" value={String(plans.length)} hint={`${activePlans.length} active`} icon={<Boxes className="size-4" />} />
        <StatCard label="Monthly plan value" value={formatCurrency(mrrPotential)} hint="one subscription per plan" icon={<CircleDollarSign className="size-4" />} />
        <StatCard label="Active subscriptions" value={String(subscriptionCount)} hint="across all plans" icon={<Sparkles className="size-4" />} />
        <StatCard label="With trial" value={String(plans.filter((plan) => plan.trial_days > 0).length)} hint="plans offering trials" icon={<Clock className="size-4" />} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search plans, products…"
        emptyTitle="No plans yet"
        emptyDescription="Create a plan to start selling recurring subscriptions."
        edit={isAdmin ? { action: savePlan, schemaKey: "plan", fields: planFields, title: "Edit plan" } : undefined}
      />

      {!isAdmin ? (
        <p className="text-[11px] text-muted-foreground">Read-only access. Admin role required to change pricing.</p>
      ) : null}
    </div>
  );
}
