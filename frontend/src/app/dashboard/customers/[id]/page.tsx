import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Wallet,
} from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { saveCustomer } from "@/lib/actions/customers";
import { PageHeader } from "@/components/page-header";
import { PortalInviteButton } from "@/components/portal-invite-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EditDialog } from "@/components/edit-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FieldDef } from "@/components/resource-form";

const customerFields: FieldDef[] = [
  { name: "name", label: "Customer name", required: true },
  { name: "company", label: "Legal company" },
  { name: "contact_name", label: "Primary contact" },
  { name: "email", label: "Billing email", type: "email", required: true },
  { name: "phone", label: "Phone" },
  { name: "country", label: "Country" },
  { name: "tax_id", label: "Tax ID" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
  },
  { name: "address", label: "Billing address", type: "textarea" },
  { name: "notes", label: "Internal notes", type: "textarea" },
];

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) notFound();

  const [subscriptionsRes, invoicesRes, paymentsRes, quotationsRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, status, quantity, started_at, current_period_end, plan:plans(name,price,interval)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, number, status, issue_date, due_date, total, amount_paid")
      .eq("customer_id", id)
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, invoice:invoices(number)")
      .eq("customer_id", id)
      .order("paid_at", { ascending: false })
      .limit(20),
    supabase
      .from("quotations")
      .select("id, number, status, total, issue_date, valid_until")
      .eq("customer_id", id)
      .order("issue_date", { ascending: false })
      .limit(10),
  ]);

  const subscriptions = (subscriptionsRes.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    quantity: number;
    started_at: string;
    current_period_end: string;
    plan: { name: string; price: number; interval: string } | null;
  }>;
  const invoices = (invoicesRes.data ?? []) as unknown as Array<{
    id: string;
    number: string;
    status: string;
    issue_date: string;
    due_date: string;
    total: number;
    amount_paid: number;
  }>;
  const payments = (paymentsRes.data ?? []) as unknown as Array<{
    id: string;
    amount: number;
    method: string;
    paid_at: string;
    invoice: { number: string } | null;
  }>;
  const quotations = (quotationsRes.data ?? []) as unknown as Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    issue_date: string;
    valid_until: string;
  }>;

  const lifetime = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const outstanding = invoices
    .filter((invoice) => invoice.status === "open")
    .reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid), 0);
  const activeSubscriptions = subscriptions.filter((sub) => sub.status === "active" || sub.status === "trialing").length;

  const defaults = {
    id: customer.id,
    name: customer.name,
    company: customer.company ?? "",
    contact_name: customer.contact_name ?? "",
    email: customer.email,
    phone: customer.phone ?? "",
    country: customer.country ?? "",
    tax_id: customer.tax_id ?? "",
    status: customer.status,
    address: customer.address ?? "",
    notes: customer.notes ?? "",
  };

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link href="/dashboard/customers">
            <ArrowLeft className="size-3.5" /> Customers
          </Link>
        </Button>
        <PageHeader
          title={customer.name}
          description={customer.company ?? customer.email}
          actions={
            <>
              <PortalInviteButton customerId={customer.id} email={customer.email} disabled={Boolean(customer.user_id)} />
              <EditDialog
                label="Edit customer"
                title="Edit customer"
                action={saveCustomer}
                schemaKey="customer"
                fields={customerFields}
                defaults={defaults}
              />
              <Button size="sm" asChild>
                <Link href={`/dashboard/invoices/new?customer=${customer.id}`}>New invoice</Link>
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lifetime revenue" value={formatCurrency(lifetime)} hint="all recorded payments" icon={<Wallet className="size-4" />} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} hint="open invoice balance" icon={<Receipt className="size-4" />} />
        <StatCard label="Active subscriptions" value={String(activeSubscriptions)} hint={`${subscriptions.length} total`} icon={<CalendarDays className="size-4" />} />
        <StatCard label="Quotations" value={String(quotations.length)} hint="all time" icon={<CreditCard className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Customer details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-[13px]">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[12px] font-medium text-primary">
                {initials(customer.name)}
              </span>
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-[12px] text-muted-foreground">{customer.contact_name ?? "No primary contact"}</p>
              </div>
            </div>
            <div className="space-y-2.5 text-[12.5px]">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5" /> {customer.email}
              </p>
              {customer.phone ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-3.5" /> {customer.phone}
                </p>
              ) : null}
              {customer.company ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="size-3.5" /> {customer.company}
                </p>
              ) : null}
              {customer.address ? (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" /> {customer.address}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-[11px] text-muted-foreground">Status</span>
              <StatusBadge value={customer.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Portal access</span>
              <span className="text-[12px]">{customer.user_id ? "Linked" : "Not invited"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Customer since</span>
              <span className="text-[12px]">{formatDate(customer.created_at)}</span>
            </div>
            {customer.tax_id ? (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Tax ID</span>
                <span className="font-mono text-[11px]">{customer.tax_id}</span>
              </div>
            ) : null}
            {customer.notes ? (
              <div className="rounded-lg bg-muted/50 p-3 text-[12px] text-muted-foreground">{customer.notes}</div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Subscriptions</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/subscriptions">Manage all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscriptions.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">No subscriptions for this customer yet.</p>
            ) : (
              subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-medium">{sub.plan?.name ?? "Plan"}</p>
                      <StatusBadge value={sub.status} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {sub.quantity} seats · renews {formatDate(sub.current_period_end)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-medium tabular-nums">
                      {formatCurrency(Number(sub.plan?.price ?? 0) * sub.quantity)}
                    </p>
                    <p className="text-[10px] capitalize text-muted-foreground">{sub.plan?.interval ?? ""}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent invoices</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/invoices">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Invoice</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Due</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-[12px] text-muted-foreground">No invoices</td>
                  </tr>
                ) : (
                  invoices.slice(0, 8).map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-0">
                      <td className="px-5 py-2.5">
                        <Link href={`/dashboard/invoices/${invoice.id}`} className="font-medium hover:text-primary hover:underline">
                          {invoice.number}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5"><StatusBadge value={invoice.status} /></td>
                      <td className="px-5 py-2.5 text-[11px] text-muted-foreground">{formatDate(invoice.due_date)}</td>
                      <td className="px-5 py-2.5 text-right text-[12px] tabular-nums">{formatCurrency(Number(invoice.total))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Payments</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/payments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">Invoice</th>
                  <th className="px-5 py-2 font-medium">Method</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-[12px] text-muted-foreground">No payments</td>
                  </tr>
                ) : (
                  payments.slice(0, 8).map((payment) => (
                    <tr key={payment.id} className="border-b last:border-0">
                      <td className="px-5 py-2.5 text-[11px] text-muted-foreground">{formatDate(payment.paid_at)}</td>
                      <td className="px-5 py-2.5 text-[12px]">{payment.invoice?.number ?? "—"}</td>
                      <td className="px-5 py-2.5"><StatusBadge value={payment.method} /></td>
                      <td className="px-5 py-2.5 text-right text-[12px] tabular-nums">{formatCurrency(Number(payment.amount))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {quotations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Quotations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Quotation</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Valid until</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((quote) => (
                  <tr key={quote.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5">
                      <Link href={`/dashboard/quotations/${quote.id}`} className="font-medium hover:text-primary hover:underline">
                        {quote.number}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5"><StatusBadge value={quote.status} /></td>
                    <td className="px-5 py-2.5 text-[11px] text-muted-foreground">{formatDate(quote.valid_until)}</td>
                    <td className="px-5 py-2.5 text-right text-[12px] tabular-nums">{formatCurrency(Number(quote.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
