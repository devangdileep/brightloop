import { Percent, TicketPercent, Repeat2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { saveDiscount } from "@/lib/actions/finance";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { CreateDialog } from "@/components/create-dialog";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import type { FieldDef } from "@/components/resource-form";

const discountFields: FieldDef[] = [
  { name: "code", label: "Discount code", placeholder: "LAUNCH20", required: true },
  {
    name: "type",
    label: "Type",
    type: "select",
    options: [
      { value: "percentage", label: "Percentage" },
      { value: "fixed", label: "Fixed amount" },
    ],
    defaultValue: "percentage",
  },
  { name: "value", label: "Value", type: "number", step: "0.01", min: 0, placeholder: "20", required: true },
  { name: "is_active", label: "Active", type: "checkbox", description: "Available for selection", defaultValue: true },
  { name: "valid_from", label: "Valid from", type: "date" },
  { name: "valid_until", label: "Valid until", type: "date" },
  { name: "max_redemptions", label: "Max redemptions", type: "number", min: 0, placeholder: "Unlimited" },
  { name: "description", label: "Description", type: "textarea", placeholder: "When should this be used?" },
];

export default async function DiscountsPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase.from("discounts").select("*").order("created_at", { ascending: false });
  const discounts = (data ?? []) as unknown as Array<{
    id: string;
    code: string;
    description: string | null;
    type: string;
    value: number;
    is_active: boolean;
    valid_from: string | null;
    valid_until: string | null;
    max_redemptions: number | null;
    times_redeemed: number;
    created_at: string;
  }>;

  const active = discounts.filter((discount) => discount.is_active);
  const redemptions = discounts.reduce((sum, discount) => sum + discount.times_redeemed, 0);
  const percentage = discounts.filter((discount) => discount.type === "percentage").length;

  const rows: TableRowData[] = discounts.map((discount) => ({
    id: discount.id,
    _edit: {
      id: discount.id,
      code: discount.code,
      description: discount.description ?? "",
      type: discount.type,
      value: Number(discount.value),
      is_active: discount.is_active,
      valid_from: discount.valid_from ?? "",
      valid_until: discount.valid_until ?? "",
      max_redemptions: discount.max_redemptions ?? "",
    },
    _actions: [
      {
        label: discount.is_active ? "Deactivate" : "Activate",
        action: "discount.toggle",
        confirm: discount.is_active ? "Deactivate this discount code?" : "Make this discount available again?",
        destructive: discount.is_active,
      },
    ],
    code: discount.code,
    description: discount.description ?? "—",
    type: discount.type,
    value: discount.type === "percentage" ? `${discount.value}%` : `$${Number(discount.value).toFixed(2)}`,
    redemptions: discount.times_redeemed,
    valid: discount.valid_until ?? discount.valid_from ? `${formatDate(discount.valid_from)} – ${formatDate(discount.valid_until)}` : "No expiry",
    status: discount.is_active ? "active" : "inactive",
  }));

  const columns: TableColumn[] = [
    { key: "code", header: "Code" },
    { key: "description", header: "Description" },
    { key: "type", header: "Type", kind: "badge" },
    { key: "value", header: "Value", align: "right" },
    { key: "redemptions", header: "Redeemed", kind: "number", align: "right" },
    { key: "valid", header: "Validity" },
    { key: "status", header: "Status", kind: "badge" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discounts"
        description="Promotional codes applied to subscriptions and invoices."
        actions={
          <CreateDialog
            label="New discount"
            title="Create discount"
            action={saveDiscount}
            schemaKey="discount"
            fields={discountFields}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Discount codes" value={String(discounts.length)} hint={`${active.length} active`} icon={<TicketPercent className="size-4" />} />
        <StatCard label="Redemptions" value={String(redemptions)} hint="all time" icon={<Repeat2 className="size-4" />} />
        <StatCard label="Percentage based" value={String(percentage)} hint="of all codes" icon={<Percent className="size-4" />} />
        <StatCard label="Limited codes" value={String(discounts.filter((discount) => discount.max_redemptions).length)} hint="with a redemption cap" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search code or description…"
        emptyTitle="No discounts"
        emptyDescription="Create a code to offer a percentage or fixed discount."
        edit={{ action: saveDiscount, schemaKey: "discount", fields: discountFields, title: "Edit discount" }}
      />
    </div>
  );
}
