import Link from "next/link";
import { Download, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { saveCustomer } from "@/lib/actions/customers";
import { PageHeader } from "@/components/page-header";
import { CreateDialog } from "@/components/create-dialog";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import type { FieldDef } from "@/components/resource-form";

const customerFields: FieldDef[] = [
  { name: "name", label: "Customer name", placeholder: "Acme Corp", required: true },
  { name: "company", label: "Legal company", placeholder: "Acme Corporation" },
  { name: "contact_name", label: "Primary contact", placeholder: "Jordan Blake" },
  { name: "email", label: "Billing email", type: "email", placeholder: "billing@acme.com", required: true },
  { name: "phone", label: "Phone", placeholder: "+1 415 555 0101" },
  { name: "country", label: "Country", placeholder: "United States" },
  { name: "tax_id", label: "Tax ID", placeholder: "US-84-2210345" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
    defaultValue: "active",
  },
  { name: "address", label: "Billing address", type: "textarea", placeholder: "Street, city, state, postal code" },
  { name: "notes", label: "Internal notes", type: "textarea", placeholder: "Anything the team should know" },
];

export default async function CustomersPage() {
  const { supabase } = await requireStaff();

  const { data } = await supabase
    .from("customers")
    .select("*, subscriptions(count), invoices(count)")
    .order("created_at", { ascending: false });

  const customers = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    company: string | null;
    contact_name: string | null;
    email: string;
    phone: string | null;
    country: string | null;
    address: string | null;
    tax_id: string | null;
    status: string;
    notes: string | null;
    user_id: string | null;
    created_at: string;
    subscriptions: { count: number }[];
    invoices: { count: number }[];
  }>;

  const rows: TableRowData[] = customers.map((customer) => ({
    id: customer.id,
    _href: `/dashboard/customers/${customer.id}`,
    _edit: {
      id: customer.id,
      name: customer.name,
      company: customer.company ?? "",
      contact_name: customer.contact_name ?? "",
      email: customer.email,
      phone: customer.phone ?? "",
      country: customer.country ?? "",
      address: customer.address ?? "",
      tax_id: customer.tax_id ?? "",
      status: customer.status,
      notes: customer.notes ?? "",
    },
    _actions: [
      {
        label: customer.status === "active" ? "Deactivate customer" : "Activate customer",
        action: "customer.toggle",
        confirm: "This changes whether the customer can be billed. Existing records are preserved.",
        destructive: customer.status === "active",
      },
    ],
    name: customer.name,
    company: customer.company ?? "—",
    email: customer.email,
    country: customer.country ?? "—",
    subscriptions: customer.subscriptions?.[0]?.count ?? 0,
    invoices: customer.invoices?.[0]?.count ?? 0,
    status: customer.status,
    portal: customer.user_id ? "Linked" : "Not invited",
    created: customer.created_at,
  }));

  const columns: TableColumn[] = [
    { key: "name", header: "Customer", kind: "entity", subKey: "company" },
    { key: "email", header: "Email" },
    { key: "country", header: "Country" },
    { key: "subscriptions", header: "Subs", kind: "number", align: "right" },
    { key: "invoices", header: "Invoices", kind: "number", align: "right" },
    { key: "status", header: "Status", kind: "badge" },
    { key: "created", header: "Added", kind: "date" },
  ];

  const active = customers.filter((customer) => customer.status === "active").length;
  const portalLinked = customers.filter((customer) => customer.user_id).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${customers.length} customers · ${active} active · ${portalLinked} with portal access`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/api/export/customers" prefetch={false}>
                <Download className="size-3.5" /> Export
              </Link>
            </Button>
            <CreateDialog
              label="New customer"
              title="Add customer"
              description="Create a customer record. You can invite them to the portal afterwards."
              action={saveCustomer}
              schemaKey="customer"
              fields={customerFields}
            />
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search customers, emails, countries…"
        emptyTitle="No customers yet"
        emptyDescription="Add your first customer to start creating subscriptions and invoices."
        edit={{ action: saveCustomer, schemaKey: "customer", fields: customerFields, title: "Edit customer" }}
      />

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Users className="size-3.5" />
        <span>
          Need portal access for a customer? Open their profile and send an invitation. Roles are stored in{" "}
          <Link href="/dashboard/settings" className="underline underline-offset-2">
            profiles
          </Link>{" "}
          and enforced by RLS.
        </span>
      </div>
    </div>
  );
}
