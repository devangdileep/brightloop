import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SetupScreen } from "@/components/setup-screen";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <SetupScreen />;
  }

  const { profile } = await requireAdmin();
  if (!profile) redirect("/login");

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
