import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Database,
  KeyRound,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { updateProfile } from "@/lib/actions/auth";
import { saveSettings } from "@/lib/actions/settings";
import { hasServiceRole } from "@/lib/supabase/config";
import { CURRENCY_OPTIONS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { BillingRunButton } from "@/components/billing-run-button";
import { TeamSettings } from "@/components/team-settings";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const { supabase, profile } = await requireProfile();
  const isAdmin = profile.role === "admin";

  const [settingsRes, taxesRes] = await Promise.all([
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("taxes").select("id, name, rate").eq("is_active", true).order("name"),
  ]);

  const settings = settingsRes.data;
  const taxes = (taxesRes.data ?? []) as unknown as Array<{ id: string; name: string; rate: number }>;

  const teamRes = isAdmin
    ? await supabase.from("profiles").select("id,email,full_name,role,created_at").order("created_at", { ascending: true })
    : { data: [] as Array<{ id: string; email: string; full_name: string | null; role: string; created_at: string }> };
  const team = teamRes.data ?? [];

  const profileFields: FieldDef[] = [
    { name: "full_name", label: "Full name", required: true, colSpan: 2 },
    { name: "phone", label: "Phone number", placeholder: "+1 415 555 0134", colSpan: 2 },
  ];

  const settingsFields: FieldDef[] = [
    { name: "company_name", label: "Company name", required: true },
    { name: "support_email", label: "Billing email", type: "email", required: true },
    {
      name: "currency",
      label: "Currency",
      type: "select",
      options: CURRENCY_OPTIONS,
      defaultValue: "USD",
    },
    { name: "invoice_prefix", label: "Invoice prefix", placeholder: "INV", required: true },
    { name: "invoice_due_days", label: "Due days", type: "number", min: 0, max: 365, defaultValue: 14 },
    {
      name: "default_tax_id",
      label: "Default tax rate",
      type: "select",
      options: taxes.map((tax) => ({ value: tax.id, label: `${tax.name} (${tax.rate}%)` })),
      placeholder: "No default tax",
    },
    { name: "address", label: "Company address", type: "textarea", colSpan: 2 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your profile, workspace configuration, team and billing automation."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="size-3" /> Role: {profile.role}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
              <p className="text-[12px] text-muted-foreground">This information appears on activity and audit records.</p>
            </CardHeader>
            <CardContent>
              <div className="mb-5 flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-[13px] font-medium text-primary">
                  {(profile.full_name ?? profile.email).slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="text-[13px] font-medium">{profile.full_name ?? "No name set"}</p>
                  <p className="text-[11px] text-muted-foreground">{profile.email} · joined {formatDate(profile.created_at)}</p>
                </div>
                <StatusBadge value={profile.role} className="ml-auto" />
              </div>
              <ResourceForm
                action={updateProfile}
                schemaKey="profile"
                fields={profileFields}
                defaults={{ full_name: profile.full_name ?? "", phone: profile.phone ?? "" }}
                submitLabel="Save profile"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
              <p className="text-[12px] text-muted-foreground">
                {isAdmin ? "Company details used on invoices and quotations." : "Company details are managed by administrators."}
              </p>
            </CardHeader>
            <CardContent>
              {isAdmin && settings ? (
                <ResourceForm
                  action={saveSettings}
                  schemaKey="settings"
                  fields={settingsFields}
                  defaults={{
                    company_name: settings.company_name,
                    support_email: settings.support_email,
                    currency: settings.currency,
                    invoice_prefix: settings.invoice_prefix,
                    invoice_due_days: settings.invoice_due_days,
                    default_tax_id: settings.default_tax_id ?? "",
                    address: settings.address ?? "",
                  }}
                  submitLabel="Save workspace"
                />
              ) : (
                <div className="grid gap-3 text-[12.5px] sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Company</p>
                    <p className="mt-1 font-medium">{settings?.company_name ?? "Brightloop Software"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Billing email</p>
                    <p className="mt-1 font-medium">{settings?.support_email ?? "billing@brightloop.io"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Currency</p>
                    <p className="mt-1 font-medium">{settings?.currency ?? "USD"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Invoice terms</p>
                    <p className="mt-1 font-medium">Net {settings?.invoice_due_days ?? 14}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle>Team & roles</CardTitle>
                <p className="text-[12px] text-muted-foreground">
                  Admin: full access · Staff: customers, subscriptions, quotes, invoices, payments · Customer: portal only.
                </p>
              </CardHeader>
              <CardContent>
                <TeamSettings members={team} currentUserId={profile.id} />
              </CardContent>
            </Card>
          ) : null}

          <Card id="automation">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Billing automation</CardTitle>
                <p className="text-[12px] text-muted-foreground">
                  Recurring invoices generate at the end of each billing period.
                </p>
              </div>
              <BillingRunButton />
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  icon: RefreshCw,
                  title: "Daily billing run",
                  description: "Edge Function generates invoices for due subscriptions and advances renewal dates.",
                  status: "Active",
                },
                {
                  icon: Clock,
                  title: "Schedule",
                  description: "Supabase Cron · every day at 02:15 UTC · job brightloop-generate-invoices.",
                  status: "Daily",
                },
                {
                  icon: Server,
                  title: "Edge Function",
                  description: "supabase/functions/generate-invoices · service-role operations run server-side only.",
                  status: "Deployed separately",
                },
                {
                  icon: Database,
                  title: "Invoice numbering",
                  description: "next_document_number() uses an atomic Postgres counter per year.",
                  status: "Atomic",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <item.icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{item.description}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">{item.status}</Badge>
                </div>
              ))}
              <div className="rounded-lg bg-muted/40 p-3 font-mono text-[11px] text-muted-foreground">
                <p className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-wide">
                  <Terminal className="size-3" /> Deploy
                </p>
                <p className="mt-1.5">supabase functions deploy generate-invoices --no-verify-jwt</p>
                <p className="mt-1">psql &quot;$DATABASE_URL&quot; -f supabase/cron.sql</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Environment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px]">
              {[
                { label: "Supabase Auth", ok: true, detail: "Email & password" },
                { label: "PostgreSQL + RLS", ok: true, detail: "13 tables protected" },
                { label: "Storage bucket", ok: true, detail: "documents (private)" },
                { label: "Service role", ok: hasServiceRole(), detail: hasServiceRole() ? "Configured (server only)" : "Not configured" },
                { label: "Edge Functions", ok: true, detail: "generate-invoices" },
                { label: "Supabase Cron", ok: true, detail: "02:15 UTC daily" },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-2 border-b pb-2.5 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                  </div>
                  <CheckCircle2 className={`size-4 shrink-0 ${item.ok ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                </div>
              ))}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="https://supabase.com/dashboard" target="_blank">
                  Open Supabase dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-[12px]">
              <div className="flex items-start gap-2.5">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Row Level Security</span> is enabled on every business
                  table. Permissions are enforced in Postgres, not only in the UI.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <KeyRound className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Role escalation blocked.</span> The{" "}
                  <code className="font-mono text-[10px]">profiles</code> trigger prevents non-admins from changing roles.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Customer isolation.</span> Portal users can only read
                  their own customer, subscriptions, invoices and payments.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Zap className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Service key never ships.</span> It is used only inside
                  server actions and Edge Functions.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { role: "Admin", access: "Everything, including products, plans, taxes, discounts and team." },
                { role: "Staff", access: "Customers, subscriptions, quotations, invoices, payments, reports." },
                { role: "Customer", access: "Own portal, invoices, payments and subscription actions." },
              ].map((item) => (
                <div key={item.role} className="rounded-lg border p-3">
                  <p className="text-[12px] font-medium">{item.role}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.access}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
