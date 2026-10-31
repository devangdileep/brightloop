"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsLeft,
  ChevronsRight,
  Command,
  LogOut,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { ADMIN_NAV_GROUPS, STAFF_NAV_GROUPS, PORTAL_NAV_GROUPS, getRoleHome } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";
import type { Profile } from "@/types";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SidebarContent({
  profile,
  collapsed = false,
  onNavigate,
  onCollapse,
  onClose,
}: {
  profile: Profile;
  collapsed?: boolean;
  onNavigate?: () => void;
  onCollapse?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const groups =
    profile.role === "admin"
      ? ADMIN_NAV_GROUPS
      : profile.role === "staff"
      ? STAFF_NAV_GROUPS
      : PORTAL_NAV_GROUPS;

  const homeHref = getRoleHome(profile.role);

  const isActive = (href: string) => {
    if (
      href === "/dashboard" ||
      href === "/admin/dashboard" ||
      href === "/staff/dashboard" ||
      href === "/portal/dashboard"
    ) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <Link href={homeHref} onClick={onNavigate} className={cn("flex items-center gap-2.5", collapsed && "hidden")}>
          <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
            <Command className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Brightloop</span>
        </Link>
        {collapsed ? (
          <Link href={homeHref} onClick={onNavigate} className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
            <Command className="size-4" />
          </Link>
        ) : null}
        {onClose ? (
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        ) : onCollapse ? (
          <Button variant="ghost" size="icon-sm" onClick={onCollapse} className="text-muted-foreground">
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {groups.map((group, groupIndex) => (
          <div key={group.label} className={cn(groupIndex > 0 && "mt-6")}>
            {!collapsed ? (
              <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                {group.label}
              </p>
            ) : null}
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground/80")} />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    {!collapsed && active ? <span className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        {profile.role !== "customer" && !collapsed ? (
          <div className="mt-8 rounded-lg border bg-card p-3 shadow-sm">
            <div className="mb-2 flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </div>
            <p className="text-[12px] font-medium">Recurring billing is on</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Invoices generate daily at 02:15 UTC via Supabase Cron.
            </p>
            <Link
              href="/dashboard/settings#automation"
              onClick={onNavigate}
              className="mt-2.5 inline-flex text-[11px] font-medium text-primary hover:underline"
            >
              View automation →
            </Link>
          </div>
        ) : null}
      </div>

      <div className="border-t border-sidebar-border p-3">
        {collapsed ? (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-[11px] text-primary">{initials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <UserMenuContent profile={profile} />
            </DropdownMenu>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-[11px] text-primary">{initials(profile.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{profile.full_name || profile.email}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{profile.email}</p>
                </div>
                <StatusBadge value={profile.role} className="capitalize" />
              </button>
            </DropdownMenuTrigger>
            <UserMenuContent profile={profile} />
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function UserMenuContent({ profile }: { profile: Profile }) {
  return (
    <DropdownMenuContent align="end" side="top" className="w-56">
      <DropdownMenuLabel className="font-normal">
        <p className="text-[13px] font-medium text-foreground">{profile.full_name || "Account"}</p>
        <p className="truncate text-[11px] text-muted-foreground">{profile.email}</p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href={profile.role === "customer" ? "/portal/profile" : "/dashboard/settings"}>
          <Settings className="size-3.5" /> {profile.role === "customer" ? "My Profile" : "Settings"}
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <form action={logout}>
        <button type="submit" className="flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-destructive outline-none transition-colors hover:bg-destructive/10">
          <LogOut className="size-3.5" /> Sign out
        </button>
      </form>
    </DropdownMenuContent>
  );
}
