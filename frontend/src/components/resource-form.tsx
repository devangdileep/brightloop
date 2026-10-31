"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formSchemas, type FormSchemaKey } from "@/lib/validations";
import type { ActionResult } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type FieldOption = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "date" | "textarea" | "select" | "checkbox";
  placeholder?: string;
  options?: FieldOption[];
  step?: string;
  min?: number;
  max?: number;
  description?: string;
  defaultValue?: string | number | boolean;
  colSpan?: 1 | 2;
  required?: boolean;
};

type Defaults = Record<string, unknown>;

export function ResourceForm({
  action,
  schemaKey,
  fields,
  defaults,
  submitLabel = "Save",
  onSuccess,
  className,
  compact,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  schemaKey: FormSchemaKey;
  fields: FieldDef[];
  defaults?: Defaults;
  submitLabel?: string;
  onSuccess?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const schema = formSchemas[schemaKey];

  const initial = React.useMemo(() => {
    const values: Defaults = {};
    for (const field of fields) {
      values[field.name] = defaults?.[field.name] ?? field.defaultValue ?? (field.type === "checkbox" ? true : "");
    }
    return values;
  }, [fields, defaults]);

  const form = useForm<FieldValues>({
    resolver: zodResolver(schema as never),
    defaultValues: initial,
  });

  async function onSubmit(values: FieldValues) {
    setPending(true);
    setServerError(null);
    try {
      const formData = new FormData();
      if (defaults?.id) formData.set("id", String(defaults.id));
      const keys = new Set([...fields.map((field) => field.name), ...Object.keys(initial)]);
      for (const key of keys) {
        if (key === "id") continue;
        const field = fields.find((item) => item.name === key);
        const value = values[key] ?? initial[key];
        if (field?.type === "checkbox") {
          formData.set(key, value ? "true" : "false");
        } else if (field?.type === "number" && (value === "" || Number.isNaN(Number(value)))) {
          formData.set(key, "");
        } else {
          formData.set(key, value === null || value === undefined ? "" : String(value));
        }
      }
      const result = await action(formData);
      if (!result.ok) {
        setServerError(result.error ?? "Something went wrong");
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(result.message ?? "Saved successfully");
      onSuccess?.();
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      setServerError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className={cn("space-y-5", className)}>
      <div className={cn("grid gap-4", compact ? "sm:grid-cols-1" : "sm:grid-cols-2")}>
        {fields.map((field) => {
          const error = form.formState.errors[field.name];
          const id = `field-${field.name}`;
          return (
            <div
              key={field.name}
              className={cn(
                "space-y-2",
                (field.type === "textarea" || field.colSpan === 2) && "sm:col-span-2"
              )}
            >
              {field.type !== "checkbox" ? (
                <Label htmlFor={id}>
                  {field.label}
                  {field.required ? <span className="ml-0.5 text-destructive">*</span> : null}
                </Label>
              ) : null}

              {field.type === "textarea" ? (
                <Textarea id={id} placeholder={field.placeholder} rows={3} {...form.register(field.name)} />
              ) : field.type === "select" ? (
                <Select id={id} {...form.register(field.name)}>
                  <option value="">{field.placeholder ?? "Select…"}</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : field.type === "checkbox" ? (
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5"
                >
                  <span>
                    <span className="block text-[13px] font-medium">{field.label}</span>
                    {field.description ? (
                      <span className="block text-[11px] text-muted-foreground">{field.description}</span>
                    ) : null}
                  </span>
                  <input
                    id={id}
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    {...form.register(field.name)}
                  />
                </label>
              ) : (
                <Input
                  id={id}
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  {...form.register(field.name, { valueAsNumber: field.type === "number" })}
                />
              )}

              {field.description && field.type !== "checkbox" ? (
                <p className="text-[11px] text-muted-foreground">{field.description}</p>
              ) : null}
              {error ? (
                <p className="text-[11px] text-destructive">
                  {typeof error.message === "string" ? error.message : "Invalid value"}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {serverError ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
