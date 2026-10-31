import Link from "next/link";
import { Command, Sparkles, ShieldCheck, TrendingUp } from "lucide-react";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.28),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(56,189,248,0.14),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.08] grid-bg" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white text-zinc-950">
              <Command className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Brightloop</span>
          </Link>
        </div>
        <div className="relative space-y-8">
          <blockquote className="max-w-md text-2xl font-medium leading-snug tracking-tight text-balance">
            “We replaced four tools and a spreadsheet with Brightloop. Our close went from nine days to two.”
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-white/10 text-sm font-medium">
              MC
            </div>
            <div>
              <p className="text-sm font-medium">Maya Chen</p>
              <p className="text-[13px] text-white/60">VP Finance, Vela Health</p>
            </div>
          </div>
          <div className="grid max-w-md grid-cols-3 gap-3">
            {[
              { icon: TrendingUp, label: "Net revenue retention", value: "118%" },
              { icon: ShieldCheck, label: "SOC 2 Type II", value: "Compliant" },
              { icon: Sparkles, label: "Billing accuracy", value: "99.98%" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur">
                <item.icon className="mb-5 size-4 text-white/70" />
                <p className="text-sm font-semibold">{item.value}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-white/50">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">© 2026 Brightloop Software, Inc.</p>
      </div>
      <div className="flex flex-col bg-background">
        <div className="flex items-center justify-between p-6 lg:justify-end">
          <Link href="/" className="inline-flex items-center gap-2 lg:hidden">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Command className="size-3.5" />
            </span>
            <span className="text-sm font-semibold">Brightloop</span>
          </Link>
          <Link href="/" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            ← Back to home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
