import { requireCustomer } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { PortalProfileForm } from "@/components/portal-profile-form";

export default async function PortalProfilePage() {
  const { supabase, profile, user } = await requireCustomer();

  const { data: customer } = await supabase
    .from("customers")
    .select("company, company_name, address, billing_address")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Manage your account preferences, contact details, and account security."
      />
      <PortalProfileForm
        initialProfile={{
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
        }}
        initialCustomer={
          customer
            ? {
                company: customer.company_name || customer.company,
                address: customer.billing_address || customer.address,
              }
            : null
        }
      />
    </div>
  );
}
