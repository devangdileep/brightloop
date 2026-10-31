import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowed = {
  invoices: "invoices",
  payments: "payments",
  subscriptions: "subscriptions",
  customers: "customers",
} as const;

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

export async function GET(_request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const table = allowed[resource as keyof typeof allowed];
  if (!table) return NextResponse.json({ error: "Unknown export" }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.from(table).select("*").limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const csv = toCsv((data ?? []) as Record<string, unknown>[]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brightloop-${resource}.csv"`,
    },
  });
}
