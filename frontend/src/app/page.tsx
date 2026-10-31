import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  Command,
  CreditCard,
  FileText,
  Gauge,
  Globe2,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

const features = [
  {
    icon: RefreshCw,
    title: "Recurring billing on autopilot",
    description:
      "Generate invoices at the end of every billing period, apply taxes and discounts, and retry failed payments without spreadsheets.",
  },
  {
    icon: FileText,
    title: "Quotes that become revenue",
    description:
      "Build multi-line quotations, send them to customers, and convert accepted proposals into subscriptions or invoices.",
  },
  {
    icon: BarChart3,
    title: "Revenue you can trust",
    description:
      "Track MRR, ARR, ARPU, churn, collections and tax liability with live dashboards built on your billing data.",
  },
  {
    icon: Users,
    title: "A portal customers love",
    description:
      "Give every customer a branded place to view invoices, payments and subscriptions, and manage renewals.",
  },
  {
    icon: ShieldCheck,
    title: "Permissions by design",
    description:
      "Admin, staff and customer roles enforced in PostgreSQL with row-level security — not just hidden buttons.",
  },
  {
    icon: Zap,
    title: "Automation that keeps up",
    description:
      "Scheduled Edge Functions handle invoice runs, while Supabase Cron keeps everything on time, every time.",
  },
];

const plans = [
  { name: "Starter", price: 29, description: "For small teams", features: ["5 seats", "10 workflows", "Email support"] },
  {
    name: "Growth",
    price: 99,
    description: "Most popular",
    features: ["25 seats", "Unlimited workflows", "Priority support", "Revenue insights"],
    highlighted: true,
  },
  {
    name: "Scale",
    price: 249,
    description: "For scaling companies",
    features: ["100 seats", "Dedicated CSM", "SSO & audit logs", "Custom contracts"],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Command className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Brightloop</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Product</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">
                Get started <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_60%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 text-center sm:pt-28">
            <Badge variant="outline" className="mx-auto mb-6 gap-1.5 rounded-full bg-card px-3 py-1 text-[11px] shadow-sm">
              <Sparkles className="size-3 text-primary" />
              Built for recurring revenue teams
            </Badge>
            <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
              Subscription billing,
              <br />
              without the busywork.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-balance text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Brightloop brings customers, plans, invoices, payments and revenue analytics into one calm workspace — so
              your team can spend less time closing books and more time growing.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/register">
                  Start free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/login">Explore the demo</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">No credit card required · Full source included · Supabase native</p>

            {/* Dashboard preview */}
            <div className="relative mx-auto mt-16 max-w-5xl">
              <div className="absolute -inset-4 rounded-2xl bg-gradient-to-b from-primary/20 to-transparent blur-2xl" />
              <div className="relative overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/10">
                <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-3">
                  <span className="size-2.5 rounded-full bg-rose-400/70" />
                  <span className="size-2.5 rounded-full bg-amber-400/70" />
                  <span className="size-2.5 rounded-full bg-emerald-400/70" />
                  <div className="mx-auto flex h-5 w-56 items-center justify-center rounded-md border bg-background text-[10px] text-muted-foreground">
                    app.brightloop.io/dashboard
                  </div>
                </div>
                <div className="grid grid-cols-[180px_1fr] text-left">
                  <div className="hidden border-r bg-sidebar p-4 sm:block">
                    <div className="mb-5 flex items-center gap-2 px-2">
                      <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
                        <Command className="size-3" />
                      </span>
                      <span className="text-xs font-semibold">Brightloop</span>
                    </div>
                    {[
                      { icon: Gauge, label: "Overview", active: true },
                      { icon: Users, label: "Customers" },
                      { icon: Layers, label: "Plans" },
                      { icon: RefreshCw, label: "Subscriptions" },
                      { icon: FileText, label: "Invoices" },
                      { icon: Wallet, label: "Payments" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                          item.active ? "bg-card font-medium shadow-sm" : "text-muted-foreground"
                        }`}
                      >
                        <item.icon className="size-3.5" />
                        {item.label}
                      </div>
                    ))}
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold">Overview</p>
                        <p className="text-[10px] text-muted-foreground">Saturday, October 31</p>
                      </div>
                      <div className="hidden items-center gap-1.5 sm:flex">
                        <div className="h-6 w-24 rounded-md border bg-background" />
                        <div className="h-6 w-16 rounded-md bg-primary" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: "MRR", value: formatCurrency(4321, "USD"), delta: "+12.4%" },
                        { label: "Active subs", value: "142", delta: "+8.2%" },
                        { label: "Collected", value: formatCurrency(18420, "USD"), delta: "+6.1%" },
                        { label: "Outstanding", value: formatCurrency(2860, "USD"), delta: "-3.4%" },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-lg border bg-background p-3">
                          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                          <p className="mt-1 text-sm font-semibold tracking-tight">{stat.value}</p>
                          <p className="mt-0.5 text-[9px] text-emerald-600">{stat.delta}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 rounded-lg border bg-background p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-[10px] font-medium">Recurring revenue</p>
                        <span className="rounded-full border px-1.5 py-0.5 text-[8px] text-muted-foreground">Last 6 months</span>
                      </div>
                      <div className="flex h-24 items-end gap-2">
                        {[38, 44, 41, 56, 64, 58, 72, 69, 82, 76, 90, 96].map((h, i) => (
                          <div key={i} className="flex-1 rounded-sm bg-primary/15" style={{ height: `${h}%` }}>
                            <div className="h-full w-full rounded-sm bg-primary/50" style={{ height: `${Math.max(h - 20, 15)}%`, marginTop: "auto" }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Logo strip */}
        <section className="border-b">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-12 gap-y-6 px-6 py-10">
            <p className="w-full text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Trusted by finance and growth teams
            </p>
            {["Acme Corp", "Northwind", "Lumen Studio", "Atlas Freight", "Vela Health", "Kite Robotics"].map((name) => (
              <span key={name} className="text-sm font-semibold tracking-tight text-muted-foreground/60">
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* Metrics */}
        <section className="border-b bg-muted/20">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4">
            {[
              { value: "99.98%", label: "Billing accuracy" },
              { value: "2.4 days", label: "Average close time" },
              { value: "118%", label: "Net revenue retention" },
              { value: "$4.2M", label: "Invoices processed" },
            ].map((metric) => (
              <div key={metric.label} className="text-center">
                <p className="text-3xl font-semibold tracking-tight">{metric.value}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-4">Platform</Badge>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything between “signed” and “paid”.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                One system of record for your commercial relationships. No more stitching together billing scripts,
                spreadsheets and three different dashboards.
              </p>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="group bg-card p-6 transition-colors hover:bg-muted/30">
                  <div className="mb-5 flex size-9 items-center justify-center rounded-lg border bg-background text-primary shadow-sm">
                    <feature.icon className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="border-b py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
            <div>
              <Badge variant="outline" className="mb-4">Workflow</Badge>
              <h2 className="text-balance text-3xl font-semibold tracking-tight">
                From quotation to cash, traceable end to end.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                Every subscription, invoice and payment is connected. See exactly which quote became which contract, and
                which payment closed which invoice.
              </p>
              <div className="mt-8 space-y-5">
                {[
                  { icon: FileText, title: "Quote", description: "Multi-line proposals with taxes and discounts." },
                  { icon: Layers, title: "Subscribe", description: "Convert accepted quotes into recurring plans." },
                  { icon: CreditCard, title: "Bill", description: "Automated periods, proration and invoice numbering." },
                  { icon: TrendingUp, title: "Analyze", description: "MRR, churn and collections in real time." },
                ].map((step, index) => (
                  <div key={step.title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex size-9 items-center justify-center rounded-full border bg-card text-primary shadow-sm">
                        <step.icon className="size-4" />
                      </div>
                      {index < 3 ? <div className="mt-1 h-full w-px bg-border" /> : null}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative rounded-2xl border bg-muted/30 p-6 sm:p-10">
              <div className="rounded-xl border bg-card p-5 shadow-xl">
                <div className="flex items-start justify-between border-b pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileText className="size-3.5" />
                      </span>
                      <p className="text-sm font-semibold">Invoice INV-2026-0241</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Acme Corp · due in 14 days</p>
                  </div>
                  <Badge variant="success">Paid</Badge>
                </div>
                <div className="space-y-3 py-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Growth subscription × 12 seats</span>
                    <span className="font-medium">{formatCurrency(1188)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">LAUNCH20 discount</span>
                    <span className="font-medium text-emerald-600">−{formatCurrency(237.6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">US Sales Tax (8.25%)</span>
                    <span className="font-medium">{formatCurrency(78.41)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-xs text-muted-foreground">Total paid</span>
                  <span className="text-lg font-semibold tracking-tight">{formatCurrency(1028.81)}</span>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-2 hidden rounded-lg border bg-card p-3 shadow-lg sm:block">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                    <Check className="size-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium">Payment recorded</p>
                    <p className="text-[10px] text-muted-foreground">Card · just now</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="border-b bg-zinc-950 py-20 text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2">
            <div>
              <Badge className="mb-4 border-white/10 bg-white/10 text-white">Security</Badge>
              <h2 className="text-balance text-3xl font-semibold tracking-tight">
                Permissions enforced where it matters — in the database.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/60">
                Brightloop uses Supabase Row Level Security on every table. Customers can only ever read their own
                invoices, staff cannot change tax rates, and admins control role assignments. Hiding a button is not a
                security model.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Lock, title: "RLS everywhere", text: "Deny-by-default policies on all 13 tables." },
                  { icon: ShieldCheck, title: "Verified sessions", text: "Cookie-based auth with token refresh." },
                  { icon: Globe2, title: "Safe by default", text: "No service keys in the browser bundle." },
                  { icon: Users, title: "Role hierarchy", text: "Admin, staff and customer scopes." },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <item.icon className="mb-3 size-4 text-white/70" />
                    <p className="text-[13px] font-medium">{item.title}</p>
                    <p className="mt-1 text-[12px] text-white/50">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-full rounded-xl border border-white/10 bg-white/5 p-1 font-mono text-xs">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2 text-[10px] text-white/40">
                  <span className="size-2 rounded-full bg-rose-400/60" />
                  <span className="size-2 rounded-full bg-amber-400/60" />
                  <span className="size-2 rounded-full bg-emerald-400/60" />
                  <span className="ml-2">policies.sql</span>
                </div>
                <pre className="overflow-x-auto p-4 leading-relaxed text-white/70">
{`create policy "Invoices: customer reads own"
on public.invoices for select
to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = invoices.customer_id
      and c.user_id = auth.uid()
  )
);`}
                </pre>
                <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-[11px] text-emerald-400">
                  <Check className="size-3.5" /> Policy applied · 0 rows leaked
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-b py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-xl text-center">
              <Badge variant="outline" className="mb-4">Pricing</Badge>
              <h2 className="text-3xl font-semibold tracking-tight">Simple plans, billed monthly.</h2>
              <p className="mt-3 text-[15px] text-muted-foreground">Start free, upgrade when your team grows. Cancel anytime.</p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-xl border bg-card p-6 ${
                    plan.highlighted ? "border-primary/40 shadow-lg shadow-primary/5 ring-1 ring-primary/20" : ""
                  }`}
                >
                  {plan.highlighted ? (
                    <Badge className="absolute -top-2.5 left-6">Most popular</Badge>
                  ) : null}
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">${plan.price}</span>
                    <span className="text-xs text-muted-foreground">/ month</span>
                  </div>
                  <Button className="mt-6 w-full" variant={plan.highlighted ? "default" : "outline"} asChild>
                    <Link href="/register">Start free trial</Link>
                  </Button>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Check className="size-3.5 text-primary" /> {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-10 text-center sm:p-16">
              <div className="absolute inset-0 grid-bg opacity-40" />
              <div className="relative">
                <h2 className="mx-auto max-w-xl text-balance text-3xl font-semibold tracking-tight">
                  Ready to make billing boring?
                </h2>
                <p className="mx-auto mt-4 max-w-md text-[15px] text-muted-foreground">
                  Spin up Brightloop in minutes with Supabase. Your data stays yours, in a Postgres database you control.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link href="/register">
                      Create your workspace <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <Command className="size-3.5" />
            </span>
            <span className="text-[13px] font-medium">Brightloop Software</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 Brightloop Software, Inc. A fictional company built for demonstration.
          </p>
        </div>
      </footer>
    </div>
  );
}
