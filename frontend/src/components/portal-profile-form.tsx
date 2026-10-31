"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Save, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updateCustomerProfile } from "@/lib/actions/portal";
import { strongPasswordSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PortalProfileForm({
  initialProfile,
  initialCustomer,
}: {
  initialProfile: { full_name: string | null; email: string; phone: string | null };
  initialCustomer: { company: string | null; address: string | null } | null;
}) {
  const router = useRouter();

  // Profile update state
  const [profileSaving, setProfileSaving] = React.useState(false);

  // Password update state
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordSaving, setPasswordSaving] = React.useState(false);

  const reqs = [
    { label: "More than 8 characters", met: newPassword.length > 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateCustomerProfile(formData);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save profile");
        return;
      }
      toast.success(res.message ?? "Profile saved");
      router.refresh();
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const validation = strongPasswordSchema.safeParse(newPassword);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Password does not meet requirements");
      return;
    }

    setPasswordSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Contact & Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4 text-primary" /> Personal & Billing Details
          </CardTitle>
          <CardDescription>
            Update your primary contact information and the billing address displayed on invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="cust_name">Full name</Label>
              <Input
                id="cust_name"
                name="full_name"
                defaultValue={initialProfile.full_name || ""}
                placeholder="Jane Doe"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust_email">Email address</Label>
              <Input
                id="cust_email"
                defaultValue={initialProfile.email}
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">
                Email changes must be requested through customer support for security verification.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust_phone">Phone number</Label>
              <Input
                id="cust_phone"
                name="phone"
                defaultValue={initialProfile.phone || ""}
                placeholder="+1 415 555 0101"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust_company">Company / Organization</Label>
              <Input
                id="cust_company"
                name="company_name"
                defaultValue={initialCustomer?.company || ""}
                placeholder="Acme Corporation"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust_billing_addr">Billing address</Label>
              <Input
                id="cust_billing_addr"
                name="billing_address"
                defaultValue={initialCustomer?.address || ""}
                placeholder="Street address, City, State, Postal code, Country"
              />
            </div>

            <Button type="submit" disabled={profileSaving} className="w-full mt-2">
              {profileSaving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
              Save Profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security & Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> Change Password
          </CardTitle>
          <CardDescription>
            Update your portal login password. Enforce strong security standards to protect your billing data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                placeholder="9+ characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_new_password">Confirm new password</Label>
              <Input
                id="confirm_new_password"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {/* Checklist */}
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-muted-foreground mb-1.5">Password requirements:</p>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                {reqs.map((req) => (
                  <div
                    key={req.label}
                    className={`flex items-center gap-1.5 ${
                      req.met ? "text-emerald-600 font-medium" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        req.met ? "bg-emerald-500" : "bg-muted-foreground/40"
                      }`}
                    />
                    {req.label}
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={passwordSaving} className="w-full mt-2">
              {passwordSaving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="size-3.5 mr-1.5" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
