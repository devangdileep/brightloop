"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Values = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm_password: "" },
  });

  async function onSubmit(values: Values) {
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated successfully");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let destination = "/portal/dashboard";
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "admin") destination = "/admin/dashboard";
        else if (profile?.role === "staff") destination = "/staff/dashboard";
      }

      router.push(destination);
      router.refresh();
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

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Ensure your password meets all complexity requirements below.</p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirm password</Label>
          <Input id="confirm_password" type="password" autoComplete="new-password" {...form.register("confirm_password")} />
          {form.formState.errors.confirm_password ? (
            <p className="text-xs text-destructive">{form.formState.errors.confirm_password.message}</p>
          ) : null}
        </div>
        {/* Password requirement checklist */}
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
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Update password
        </Button>
      </form>
    </div>
  );
}
