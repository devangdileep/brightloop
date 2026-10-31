"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
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

export function EditDialog({
  label = "Edit",
  title = "Edit record",
  description,
  action,
  schemaKey,
  fields,
  defaults,
  submitLabel = "Save changes",
  variant = "outline",
}: {
  label?: string;
  title?: string;
  description?: string;
  action: (formData: FormData) => Promise<ActionResult>;
  schemaKey: FormSchemaKey;
  fields: FieldDef[];
  defaults?: Record<string, unknown>;
  submitLabel?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          <Pencil className="size-3.5" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
