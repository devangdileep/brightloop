"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { authRegisterSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Values = z.infer<typeof authRegisterSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(authRegisterSchema),
    defaultValues: { full_name: "", email: "", password: "", confirm_password: "" },
  });

  async function onSubmit(values: Values) {
    setPending(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.full_name, role: "customer" },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal/dashboard`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.session) {
        toast.success("Account created successfully");
        router.push("/portal/dashboard");
        router.refresh();
        return;
      }
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  const passwordVal = form.watch("password") || "";
  const reqs = [
    { label: "More than 8 characters", met: passwordVal.length > 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(passwordVal) },
    { label: "One lowercase letter", met: /[a-z]/.test(passwordVal) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(passwordVal) },
  ];

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to your email. Confirm it to finish setting up your Brightloop account.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Sign up for a customer portal account to manage subscriptions and invoices.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" autoComplete="name" placeholder="Jordan Blake" {...form.register("full_name")} />
          {form.formState.errors.full_name ? (
            <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" placeholder="9+ characters" {...form.register("password")} />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm</Label>
            <Input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              {...form.register("confirm_password")}
            />
            {form.formState.errors.confirm_password ? (
              <p className="text-xs text-destructive">{form.formState.errors.confirm_password.message}</p>
            ) : null}
          </div>
        </div>

        {/* Real-time password requirement checklist */}
        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="font-medium text-muted-foreground mb-1.5">Password requirements:</p>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            {reqs.map((req) => (
              <div key={req.label} className={`flex items-center gap-1.5 ${req.met ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                <span className={`size-1.5 rounded-full ${req.met ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                {req.label}
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Create customer account
        </Button>
      </form>

      <p className="text-center text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
