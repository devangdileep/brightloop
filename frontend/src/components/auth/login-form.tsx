"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { authLoginSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeRedirect } from "@/lib/utils";

type Values = z.infer<typeof authLoginSchema>;

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const form = useForm<Values>({ resolver: zodResolver(authLoginSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: Values) {
    setPending(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile?.status === "inactive" || profile?.status === "suspended") {
          await supabase.auth.signOut();
          toast.error("Your account has been deactivated. Please contact an administrator.");
          return;
        }

        toast.success("Welcome back");
        const role = profile?.role ?? "customer";
        const roleHome =
          role === "admin"
            ? "/admin/dashboard"
            : role === "staff"
            ? "/staff/dashboard"
            : "/portal/dashboard";

        const destination = next && next !== "/dashboard" ? safeRedirect(next) : roleHome;
        router.push(destination);
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error. Please try again.";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Brightloop</h1>
        <p className="text-sm text-muted-foreground">Manage subscriptions, billing and revenue in one place.</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Sign in
        </Button>
      </form>

      <p className="text-center text-[13px] text-muted-foreground">
        New to Brightloop?{" "}
        <Link href="/register" className="font-medium text-foreground hover:underline">
          Create an account
        </Link>
      </p>

      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Demo tip</p>
        <p className="mt-1">
          Register, then promote your account in Supabase:{" "}
          <code className="font-mono">update profiles set role=&apos;admin&apos; where email=&apos;you@example.com&apos;;</code>
        </p>
      </div>
    </div>
  );
}
