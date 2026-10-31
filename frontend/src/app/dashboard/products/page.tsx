import { Package, Shapes, Tags } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { saveProduct } from "@/lib/actions/catalog";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { CreateDialog } from "@/components/create-dialog";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import type { FieldDef } from "@/components/resource-form";

const productFields: FieldDef[] = [
  { name: "name", label: "Product name", placeholder: "Brightloop Core", required: true },
  { name: "category", label: "Category", placeholder: "Platform" },
  { name: "base_price", label: "Base price", type: "number", step: "0.01", min: 0, placeholder: "0.00", required: true },
  { name: "is_active", label: "Active", type: "checkbox", description: "Available for new plans", defaultValue: true },
  { name: "description", label: "Description", type: "textarea", placeholder: "What does this product do?" },
];

export default async function ProductsPage() {
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";

  const { data } = await supabase
    .from("products")
    .select("*, plans(count)")
    .order("created_at", { ascending: true });

  const products = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    base_price: number;
    is_active: boolean;
    created_at: string;
    plans: { count: number }[];
  }>;

  const rows: TableRowData[] = products.map((product) => ({
    id: product.id,
    _edit: {
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      category: product.category ?? "",
      base_price: Number(product.base_price),
      is_active: product.is_active,
    },
    _actions: isAdmin
      ? [
          {
            label: product.is_active ? "Archive product" : "Restore product",
            action: "product.toggle",
            confirm: product.is_active
              ? "Archiving hides this product from new plans. Existing plans keep working."
              : "Restore this product to the active catalog.",
            destructive: product.is_active,
          },
        ]
      : [],
    name: product.name,
    category: product.category ?? "—",
    plans: product.plans?.[0]?.count ?? 0,
    base_price: Number(product.base_price),
    status: product.is_active ? "active" : "inactive",
    created: product.created_at,
  }));

  const columns: TableColumn[] = [
    { key: "name", header: "Product", kind: "entity", subKey: "category" },
    { key: "plans", header: "Plans", kind: "number", align: "right" },
    { key: "base_price", header: "Base price", kind: "currency", align: "right" },
    { key: "status", header: "Status", kind: "badge" },
    { key: "created", header: "Created", kind: "date" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="The catalog your subscription plans are built on."
        actions={
          isAdmin ? (
            <CreateDialog
              label="New product"
              title="Add product"
              description="Products group plans and services in your catalog."
              action={saveProduct}
              schemaKey="product"
              fields={productFields}
            />
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Products" value={String(products.length)} hint={`${products.filter((p) => p.is_active).length} active`} icon={<Package className="size-4" />} />
        <StatCard label="Plans" value={String(products.reduce((sum, product) => sum + (product.plans?.[0]?.count ?? 0), 0))} hint="across all products" icon={<Shapes className="size-4" />} />
        <StatCard label="Categories" value={String(new Set(products.map((product) => product.category).filter(Boolean)).size)} hint="catalog groups" icon={<Tags className="size-4" />} />
        <StatCard label="Catalog value" value={formatCurrency(products.reduce((sum, product) => sum + Number(product.base_price), 0))} hint="sum of base prices" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search products, categories…"
        emptyTitle="No products yet"
        emptyDescription="Add a product before creating subscription plans."
        edit={isAdmin ? { action: saveProduct, schemaKey: "product", fields: productFields, title: "Edit product" } : undefined}
      />

      {!isAdmin ? (
        <p className="text-[11px] text-muted-foreground">You have read-only access to the product catalog. Admins manage products, plans, taxes and discounts.</p>
      ) : null}
    </div>
  );
}
