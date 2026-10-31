import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, customer:customers(*), items:invoice_items(*)")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Fast-path: If the invoice PDF is already generated and stored by the backend,
  // stream it directly from the private 'documents' bucket.
  if (invoice.pdf_path) {
    const { data: storedFile, error: storageError } = await supabase.storage
      .from("documents")
      .download(invoice.pdf_path);

    if (!storageError && storedFile) {
      const buffer = Buffer.from(await storedFile.arrayBuffer());
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
  }

  // Fallback: If not yet stored, generate dynamically
  // Customers can read their own invoice and download the PDF, but only staff
  // may write to the private bucket or persist the generated document path.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const canStore = profile?.role === "admin" || profile?.role === "staff";

  const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const customer = invoice.customer as {
    name: string;
    email: string;
    address: string | null;
    tax_id: string | null;
  } | null;
  const items = (invoice.items ?? []) as Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height, width } = page.getSize();
  const ink = rgb(0.12, 0.12, 0.14);
  const muted = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.9, 0.9, 0.92);
  const accent = rgb(0.32, 0.24, 0.85);

  // Header
  page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: rgb(0.98, 0.98, 0.99) });
  page.drawText(settings?.company_name ?? "Brightloop Software", { x: 48, y: height - 60, size: 18, font: bold, color: ink });
  page.drawText(settings?.address ?? "228 Market Street, San Francisco, CA", {
    x: 48,
    y: height - 80,
    size: 8.5,
    font,
    color: muted,
  });
  page.drawText(settings?.support_email ?? "billing@brightloop.io", { x: 48, y: height - 93, size: 8.5, font, color: muted });

  page.drawText("INVOICE", { x: width - 140, y: height - 56, size: 20, font: bold, color: accent });
  page.drawText(invoice.number, { x: width - 140, y: height - 74, size: 10, font, color: ink });
  page.drawText(`Issued ${formatDate(invoice.issue_date)}`, { x: width - 140, y: height - 88, size: 8, font, color: muted });
  page.drawText(`Due ${formatDate(invoice.due_date)}`, { x: width - 140, y: height - 100, size: 8, font, color: muted });

  // Bill to
  page.drawText("BILL TO", { x: 48, y: height - 150, size: 8, font: bold, color: muted });
  page.drawText(customer?.name ?? "Customer", { x: 48, y: height - 166, size: 11, font: bold, color: ink });
  page.drawText(customer?.email ?? "", { x: 48, y: height - 180, size: 9, font, color: muted });
  if (customer?.address) page.drawText(customer.address, { x: 48, y: height - 194, size: 9, font, color: muted });
  if (customer?.tax_id) page.drawText(`Tax ID: ${customer.tax_id}`, { x: 48, y: height - 208, size: 9, font, color: muted });

  page.drawText("STATUS", { x: width - 140, y: height - 150, size: 8, font: bold, color: muted });
  page.drawText(String(invoice.status).toUpperCase(), { x: width - 140, y: height - 166, size: 11, font: bold, color: ink });
  page.drawText(`Balance due ${formatCurrency(Number(invoice.total) - Number(invoice.amount_paid), invoice.currency)}`, {
    x: width - 140,
    y: height - 182,
    size: 8.5,
    font,
    color: muted,
  });

  // Table
  let y = height - 260;
  page.drawRectangle({ x: 48, y: y - 8, width: width - 96, height: 24, color: rgb(0.96, 0.96, 0.98) });
  page.drawText("DESCRIPTION", { x: 56, y, size: 8, font: bold, color: muted });
  page.drawText("QTY", { x: 380, y, size: 8, font: bold, color: muted });
  page.drawText("UNIT PRICE", { x: 420, y, size: 8, font: bold, color: muted });
  page.drawText("AMOUNT", { x: 500, y, size: 8, font: bold, color: muted });
  y -= 28;

  for (const item of items) {
    const description = String(item.description).slice(0, 62);
    page.drawText(description, { x: 56, y, size: 9.5, font: font, color: ink });
    page.drawText(String(item.quantity), { x: 388, y, size: 9.5, font: font, color: ink });
    page.drawText(formatCurrency(Number(item.unit_price), invoice.currency), { x: 420, y, size: 9.5, font: font, color: ink });
    page.drawText(formatCurrency(Number(item.amount), invoice.currency), { x: 500, y, size: 9.5, font: font, color: ink });
    page.drawLine({ start: { x: 48, y: y - 10 }, end: { x: width - 48, y: y - 10 }, thickness: 0.5, color: line });
    y -= 28;
  }

  // Totals
  y -= 10;
  const totalsX = 370;
  const valueX = 500;
  page.drawText("Subtotal", { x: totalsX, y, size: 9, font, color: muted });
  page.drawText(formatCurrency(Number(invoice.subtotal), invoice.currency), { x: valueX, y, size: 9, font, color: ink });
  y -= 18;
  if (Number(invoice.discount_total) > 0) {
    page.drawText("Discount", { x: totalsX, y, size: 9, font, color: muted });
    page.drawText(`-${formatCurrency(Number(invoice.discount_total), invoice.currency)}`, { x: valueX, y, size: 9, font, color: ink });
    y -= 18;
  }
  page.drawText("Tax", { x: totalsX, y, size: 9, font, color: muted });
  page.drawText(formatCurrency(Number(invoice.tax_total), invoice.currency), { x: valueX, y, size: 9, font, color: ink });
  y -= 24;
  page.drawLine({ start: { x: totalsX, y: y + 8 }, end: { x: width - 48, y: y + 8 }, thickness: 0.7, color: line });
  page.drawText("Total", { x: totalsX, y, size: 11, font: bold, color: ink });
  page.drawText(formatCurrency(Number(invoice.total), invoice.currency), { x: valueX, y, size: 11, font: bold, color: ink });
  y -= 18;
  page.drawText("Amount paid", { x: totalsX, y, size: 9, font, color: muted });
  page.drawText(formatCurrency(Number(invoice.amount_paid), invoice.currency), { x: valueX, y, size: 9, font, color: ink });

  if (invoice.notes) {
    page.drawText("NOTES", { x: 48, y: y - 30, size: 8, font: bold, color: muted });
    page.drawText(String(invoice.notes).slice(0, 95), { x: 48, y: y - 46, size: 9, font, color: muted });
  }

  page.drawText("Thank you for your business.", { x: 48, y: 60, size: 9, font, color: muted });
  page.drawText(`${settings?.company_name ?? "Brightloop Software"} · ${settings?.support_email ?? "billing@brightloop.io"}`, {
    x: 48,
    y: 44,
    size: 8,
    font,
    color: muted,
  });

  const bytes = await doc.save();
  const path = `invoices/${invoice.customer_id}/${invoice.id}.pdf`;

  if (canStore) {
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (!uploadError) {
      await supabase.from("invoices").update({ pdf_path: path }).eq("id", invoice.id);
    }
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
