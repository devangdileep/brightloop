import { requireCustomer } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { PortalPlansList, type PlanItem } from "@/components/portal-plans-list";

export default async function PortalPlansPage() {
  const { supabase } = await requireCustomer();

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, description, price, interval, interval_count, trial_days, features, is_active")
    .eq("is_active", true)
    .order("price", { ascending: true });

  const activePlans = (plans ?? []) as unknown as PlanItem[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Available Subscription Plans"
        description="Choose a subscription plan tailored to your team's needs. Upgrade, downgrade, or pause anytime."
      />
      <PortalPlansList plans={activePlans} />
    </div>
  );
}
