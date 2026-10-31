import { AuthShell } from "@/components/auth/auth-shell";
import { SetupScreen } from "@/components/setup-screen";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen">
        <SetupScreen />
      </div>
    );
  }
  return <AuthShell>{children}</AuthShell>;
}
