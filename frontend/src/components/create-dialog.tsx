"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type { FormSchemaKey } from "@/lib/validations";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ResourceForm, type FieldDef } from "@/components/resource-form";

export function CreateDialog({
  label,
  title,
  description,
  action,
  schemaKey,
  fields,
  defaults,
  submitLabel = "Create",
  variant = "default",
  size = "default",
  icon,
}: {
  label: string;
  title?: string;
  description?: string;
  action: (formData: FormData) => Promise<ActionResult>;
  schemaKey: FormSchemaKey;
  fields: FieldDef[];
  defaults?: Record<string, unknown>;
  submitLabel?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          {icon ?? <Plus className="size-4" />}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? label}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <ResourceForm
          action={action}
          schemaKey={schemaKey}
          fields={fields}
          defaults={defaults}
          submitLabel={submitLabel}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
