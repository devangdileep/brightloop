import { Globe2, ReceiptText, Tags } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { saveTax } from "@/lib/actions/finance";
import { PageHeader } from "@/components/page-header";
import { CreateDialog } from "@/components/create-dialog";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import type { FieldDef } from "@/components/resource-form";

const taxFields: FieldDef[] = [
  { name: "name", label: "Tax name", placeholder: "UK VAT", required: true },
  { name: "rate", label: "Rate (%)", type: "number", step: "0.01", min: 0, max: 100, placeholder: "20", required: true },
  { name: "country", label: "Country", placeholder: "United Kingdom" },
  { name: "is_default", label: "Default tax", type: "checkbox", description: "Pre-selected on new invoices", defaultValue: false },
  { name: "is_active", label: "Active", type: "checkbox", description: "Available for use", defaultValue: true },
];

export default async function TaxesPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase.from("taxes").select("*").order("rate", { ascending: false });
  const taxes = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    rate: number;
    country: string | null;
    is_default: boolean;
    is_active: boolean;
  }>;

  const active = taxes.filter((tax) => tax.is_active);
  const averageRate = active.length
    ? active.reduce((sum, tax) => sum + Number(tax.rate), 0) / active.length
    : 0;

  const rows: TableRowData[] = taxes.map((tax) => ({
    id: tax.id,
    _edit: {
      id: tax.id,
      name: tax.name,
      rate: Number(tax.rate),
      country: tax.country ?? "",
      is_default: tax.is_default,
      is_active: tax.is_active,
    },
    _actions: [
      {
        label: tax.is_active ? "Deactivate" : "Activate",
        action: "tax.toggle",
        confirm: tax.is_active ? "Deactivate this tax rate? Existing invoices are unaffected." : "Make this tax rate available again?",
        destructive: tax.is_active,
      },
    ],
    name: tax.name,
    rate: `${Number(tax.rate).toFixed(2)}%`,
    country: tax.country ?? "All countries",
    default: tax.is_default ? "Default" : "—",
    status: tax.is_active ? "active" : "inactive",
  }));

  const columns: TableColumn[] = [
    { key: "name", header: "Tax", kind: "entity", subKey: "country" },
    { key: "rate", header: "Rate", align: "right" },
    { key: "country", header: "Country" },
    { key: "default", header: "Default" },
    { key: "status", header: "Status", kind: "badge" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxes"
        description="Tax rates applied to invoices and quotations."
        actions={
          <CreateDialog label="New tax rate" title="Create tax rate" action={saveTax} schemaKey="tax" fields={taxFields} />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tax rates" value={String(taxes.length)} hint={`${active.length} active`} icon={<Tags className="size-4" />} />
        <StatCard label="Average rate" value={`${averageRate.toFixed(2)}%`} hint="active rates" icon={<ReceiptText className="size-4" />} />
        <StatCard label="Countries" value={String(new Set(taxes.map((tax) => tax.country).filter(Boolean)).size)} hint="configured" icon={<Globe2 className="size-4" />} />
        <StatCard label="Default rate" value={taxes.find((tax) => tax.is_default) ? `${taxes.find((tax) => tax.is_default)?.rate}%` : "None"} hint="pre-selected" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search taxes or countries…"
        emptyTitle="No tax rates"
        emptyDescription="Add a tax rate to apply it to invoices and quotations."
        edit={{ action: saveTax, schemaKey: "tax", fields: taxFields, title: "Edit tax rate" }}
      />
    </div>
  );
}
