import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SetupScreen } from "@/components/setup-screen";
import { requireStaff } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <SetupScreen />;
  }

  const { profile } = await requireStaff();
  if (!profile) redirect("/login");

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
