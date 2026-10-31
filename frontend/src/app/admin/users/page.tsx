import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import {
  AdminUserManagement,
  type CustomerRow,
  type StaffRow,
} from "@/components/admin-user-management";

export default async function AdminUsersPage() {
  const { supabase, profile } = await requireAdmin();

  // Parallel fetch customers and staff
  const [customersRes, staffRes] = await Promise.all([
    supabase
      .from("customers")
      .select("*, subscriptions(count)")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("*, staff_details(*)")
      .eq("role", "staff")
      .order("created_at", { ascending: false }),
  ]);

  const rawCustomers = (customersRes.data ?? []) as unknown as Array<
    CustomerRow & { subscriptions?: { count: number }[] }
  >;

  const customers: CustomerRow[] = rawCustomers.map((c) => ({
    ...c,
    subscriptionsCount: c.subscriptions?.[0]?.count ?? 0,
  }));

  const staff = (staffRes.data ?? []) as unknown as StaffRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage customer accounts, create staff members, configure roles and review access privileges."
      />
      <AdminUserManagement
        customers={customers}
        staff={staff}
        currentAdminId={profile.id}
      />
    </div>
  );
}
