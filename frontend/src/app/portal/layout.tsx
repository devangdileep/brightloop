import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SetupScreen } from "@/components/setup-screen";
import { requireCustomer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <SetupScreen />;
  }

  const { profile } = await requireCustomer();
  if (!profile) redirect("/login");

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
