import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  Plus,
  Receipt,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { requireAdmin } from "@/lib/auth";
import { formatCurrency, formatDate, fromNow } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { BillingRunButton } from "@/components/billing-run-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StaffJoin = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string;
  staff_details?: {
    department: string | null;
    designation: string | null;
    joined_at: string;
  }[];
};

export default async function AdminDashboardPage() {
  const { supabase, profile } = await requireAdmin();

  const now = new Date();

  // Parallel database queries for admin metrics
  const [
    customersRes,
    staffRes,
    subscriptionsRes,
    invoicesRes,
    paymentsRes,
    activityLogsRes,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, email, company, status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, email, full_name, role, status, created_at, staff_details(department, designation, joined_at)")
      .eq("role", "staff")
      .order("created_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("id, status, quantity, started_at, current_period_end, plan:plans(name, price, interval), customer:customers(name, email)")
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, number, status, total, amount_paid, issue_date, due_date, customer:customers(name)")
      .order("issue_date", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, paid_at, method, reference, customer:customers(name), invoice:invoices(number)")
      .order("paid_at", { ascending: false })
      .limit(10),
    supabase
      .from("activity_logs")
      .select("id, action, entity_type, entity_id, description, created_at, user:profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const customers = customersRes.data ?? [];
  const staffMembers = (staffRes.data ?? []) as unknown as StaffJoin[];
  const subscriptions = (subscriptionsRes.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    quantity: number;
    started_at: string;
    current_period_end: string;
    plan: { name: string; price: number; interval: string } | null;
    customer: { name: string; email: string } | null;
  }>;
  const invoices = (invoicesRes.data ?? []) as unknown as Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    amount_paid: number;
    issue_date: string;
    due_date: string;
    customer: { name: string } | null;
  }>;
  const payments = (paymentsRes.data ?? []) as unknown as Array<{
    id: string;
    amount: number;
    paid_at: string;
    method: string;
    reference: string | null;
    customer: { name: string } | null;
    invoice: { number: string } | null;
  }>;
  const activityLogs = (activityLogsRes.data ?? []) as unknown as Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    description: string | null;
    created_at: string;
    user: { full_name: string | null; email: string } | null;
  }>;

  // Key KPI metrics calculations
  const totalCustomers = customers.length;
  const totalStaff = staffMembers.length;
  const activeSubs = subscriptions.filter((sub) => sub.status === "active" || sub.status === "trialing");
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const openInvoices = invoices.filter((inv) => inv.status === "open");
  const outstandingBalance = openInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total) - Number(inv.amount_paid)),
    0
  );
  const overdueInvoicesCount = openInvoices.filter(
    (inv) => new Date(`${inv.due_date}T23:59:59`) < now
  ).length;

  const recentCustomers = customers.slice(0, 5);
  const recentStaff = staffMembers.slice(0, 5);
  const recentSubs = subscriptions.slice(0, 5);
  const recentPayments = payments.slice(0, 5);

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${profile.full_name?.split(" ")[0] ?? "Administrator"}`}
        description={`${format(now, "EEEE, MMMM d, yyyy")} · Platform Administration & System Overview`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/users">
                <Users className="size-4 mr-1.5" /> Manage Users
              </Link>
            </Button>
            <BillingRunButton />
            <Button asChild size="sm">
              <Link href="/dashboard/invoices/new">
                <Plus className="size-4 mr-1.5" /> New Invoice
              </Link>
            </Button>
          </div>
        }
      />

      {/* Primary KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total Customers"
          value={String(totalCustomers)}
          change={`${customers.filter((c) => c.status === "active").length} active`}
          trend="up"
          hint="registered accounts"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Total Staff Members"
          value={String(totalStaff)}
          change={`${staffMembers.filter((s) => s.status !== "inactive").length} active`}
          trend="neutral"
          hint="team operations"
          icon={<ShieldCheck className="size-4" />}
        />
        <StatCard
          label="Active Subscriptions"
          value={String(activeSubs.length)}
          change={`${subscriptions.length} lifetime`}
          trend="up"
          hint="recurring contracts"
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatCard
          label="Total Collected Revenue"
          value={formatCurrency(totalRevenue)}
          change={`${payments.length} payments`}
          trend="up"
          hint="lifetime collections"
          icon={<CircleDollarSign className="size-4" />}
        />
        <StatCard
          label="Outstanding Invoices"
          value={formatCurrency(outstandingBalance)}
          change={`${openInvoices.length} awaiting payment`}
          trend="neutral"
          hint="open balance"
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="Overdue Invoices"
          value={String(overdueInvoicesCount)}
          change={overdueInvoicesCount > 0 ? "Requires action" : "All current"}
          trend={overdueInvoicesCount > 0 ? "down" : "up"}
          hint="past due date"
          icon={<Clock className="size-4" />}
        />
      </div>

      {/* Main Grid: Registrations & Staff */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Customers */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Customer Registrations</CardTitle>
              <p className="text-[12px] text-muted-foreground">Newly registered or imported customer accounts</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/users?tab=customers">
                View all <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentCustomers.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">No customers registered yet.</p>
              ) : (
                recentCustomers.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{customer.email} {customer.company ? `· ${customer.company}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{fromNow(customer.created_at)}</span>
                      <StatusBadge value={customer.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recently Added Staff */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Staff Members</CardTitle>
              <p className="text-[12px] text-muted-foreground">Active staff managing daily business operations</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/users?tab=staff">
                View all <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentStaff.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <p>No staff accounts created yet.</p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href="/admin/users?tab=staff">
                      <UserPlus className="size-3.5 mr-1" /> Add Staff Member
                    </Link>
                  </Button>
                </div>
              ) : (
                recentStaff.map((staff) => {
                  const detail = staff.staff_details?.[0];
                  return (
                    <div key={staff.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{staff.full_name || staff.email}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {detail?.designation ?? "Staff"} {detail?.department ? `· ${detail.department}` : ""} · {staff.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge value={staff.status || "active"} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions & Payments Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Subscriptions */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Subscriptions</CardTitle>
              <p className="text-[12px] text-muted-foreground">Latest recurring plans activated</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/subscriptions">
                View all <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentSubs.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">No subscriptions recorded.</p>
              ) : (
                recentSubs.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{sub.customer?.name ?? "Customer"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {sub.plan?.name ?? "Plan"} ({sub.quantity} seat{sub.quantity === 1 ? "" : "s"}) · Renews {formatDate(sub.current_period_end)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(Number(sub.plan?.price ?? 0) * sub.quantity)}
                      </p>
                      <StatusBadge value={sub.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Payments</CardTitle>
              <p className="text-[12px] text-muted-foreground">Latest transactions collected</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/payments">
                View all <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentPayments.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">No payments recorded yet.</p>
              ) : (
                recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <CreditCard className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.customer?.name ?? "Customer"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.invoice?.number ?? "Payment"} · {formatDate(p.paid_at)} · {p.method}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600 tabular-nums">
                      +{formatCurrency(Number(p.amount))}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Activity Logs (Audit Feed) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-primary" /> System Activity Logs
            </CardTitle>
            <p className="text-[12px] text-muted-foreground">Live audit trail of administrative and operational events</p>
          </div>
          <Badge variant="outline" className="text-[11px]">Audit Protected</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {activityLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Shield className="mx-auto size-6 mb-2 text-muted-foreground/50" />
                No system activity recorded in this session yet. Actions like staff creation, status updates, and billing runs will appear here.
              </div>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-4 text-xs hover:bg-muted/20">
                  <div className="min-w-0 pr-4">
                    <p className="font-medium text-foreground">{log.description || log.action}</p>
                    <p className="text-muted-foreground mt-0.5">
                      Actor: {log.user?.full_name || log.user?.email || "System"} · Entity: {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-muted-foreground text-[11px] whitespace-nowrap">
                    {fromNow(log.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
