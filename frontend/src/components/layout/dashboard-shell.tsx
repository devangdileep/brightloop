"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import type { Profile } from "@/types";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SidebarContent } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DashboardShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const collapsed = React.useSyncExternalStore(
    (callback) => {
      window.addEventListener("brightloop:sidebar", callback);
      return () => window.removeEventListener("brightloop:sidebar", callback);
    },
    () => window.localStorage.getItem("brightloop.sidebar") === "collapsed",
    () => false
  );
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const pathname = usePathname();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    window.localStorage.setItem("brightloop.sidebar", next ? "collapsed" : "expanded");
    window.dispatchEvent(new Event("brightloop:sidebar"));
  }

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));
  const page = navItems.find((item) =>
    item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href)
  );
  const filtered = navItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        <SidebarContent
          profile={profile}
          collapsed={collapsed}
          onCollapse={toggleCollapsed}
        />
      </aside>

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <div className="hidden min-w-0 items-center gap-2 text-[13px] sm:flex">
            <span className="text-muted-foreground">Brightloop</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="truncate font-medium">{page?.label ?? "Dashboard"}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden h-8 w-56 items-center gap-2 rounded-lg border bg-card px-2.5 text-[12px] text-muted-foreground shadow-xs transition-colors hover:border-ring/40 md:flex"
            >
              <Search className="size-3.5" />
              <span>Search…</span>
              <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setSearchOpen(true)}>
              <Search className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="relative">
                  <Bell className="size-4" />
                  <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary ring-2 ring-background" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/invoices" className="flex flex-col items-start gap-0.5">
                    <span className="text-[13px] font-medium">Open invoices need attention</span>
                    <span className="text-[11px] font-normal text-muted-foreground">Review balances and record payments.</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/subscriptions" className="flex flex-col items-start gap-0.5">
                    <span className="text-[13px] font-medium">Renewals approaching</span>
                    <span className="text-[11px] font-normal text-muted-foreground">Subscriptions ending this period.</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/quotations" className="flex flex-col items-start gap-0.5">
                    <span className="text-[13px] font-medium">Quotations awaiting response</span>
                    <span className="text-[11px] font-normal text-muted-foreground">Follow up on sent proposals.</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
            <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <Link href="/dashboard/settings" className="flex items-center gap-2 rounded-full pl-0.5 pr-2 py-0.5 transition-colors hover:bg-accent">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {(profile.full_name || profile.email).slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden max-w-28 truncate text-[12px] font-medium sm:block">
                {profile.full_name || profile.email}
              </span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      {/* Mobile navigation */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-0 top-0 h-full w-[280px] max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0">
          <div className="h-full">
            <SidebarContent profile={profile} onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Command palette */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="top-[20%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Jump to a page…"
              className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No pages match “{query}”.</p>
            ) : (
              filtered.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors hover:bg-accent"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                  <Badge variant="secondary" className="ml-auto text-[10px]">Go</Badge>
                </Link>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
