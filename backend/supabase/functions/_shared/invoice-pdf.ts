// Shared Invoice PDF generator for Supabase Edge Functions
// Uses pdf-lib for vector-based, fast, multi-page capable PDF generation in Deno.

import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

export interface InvoicePdfData {
  invoice: {
    id: string;
    number: string;
    issue_date: string;
    due_date: string;
    period_start?: string | null;
    period_end?: string | null;
    status: string;
    subtotal: number;
    discount_total: number;
    tax_total: number;
    total: number;
    amount_paid: number;
    currency?: string | null;
    notes?: string | null;
  };
  customer: {
    name: string;
    email: string;
    company?: string | null;
    address?: string | null;
    tax_id?: string | null;
  } | null;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  settings?: {
    company_name?: string | null;
    support_email?: string | null;
    currency?: string | null;
    address?: string | null;
  } | null;
}

function formatCurrency(amount: number, currency = "USD"): string {
  const curr = currency ?? "USD";
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  switch (curr.toUpperCase()) {
    case "USD":
      return `$${formatted}`;
    case "EUR":
      return `€${formatted}`;
    case "GBP":
      return `£${formatted}`;
    case "INR":
      return `₹${formatted}`;
    default:
      return `${curr} ${formatted}`;
  }
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const { invoice, customer, items, settings } = data;
  const currency = invoice.currency || settings?.currency || "USD";

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;

  const ink = rgb(0.12, 0.12, 0.14);
  const muted = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.9, 0.9, 0.92);
  const accent = rgb(0.32, 0.24, 0.85);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let { height, width } = page.getSize();

  // Function to draw header on page 1
  const drawFirstPageHeader = () => {
    // Header background banner
    page.drawRectangle({
      x: 0,
      y: height - 110,
      width,
      height: 110,
      color: rgb(0.98, 0.98, 0.99),
    });

    // Company profile
    page.drawText(settings?.company_name ?? "Brightloop Software", {
      x: 48,
      y: height - 60,
      size: 18,
      font: bold,
      color: ink,
    });
    page.drawText(settings?.address ?? "228 Market Street, San Francisco, CA", {
      x: 48,
      y: height - 80,
      size: 8.5,
      font,
      color: muted,
    });
    page.drawText(settings?.support_email ?? "billing@brightloop.io", {
      x: 48,
      y: height - 93,
      size: 8.5,
      font,
      color: muted,
    });

    // Invoice badge and numbering
    page.drawText("INVOICE", {
      x: width - 140,
      y: height - 56,
      size: 20,
      font: bold,
      color: accent,
    });
    page.drawText(invoice.number, {
      x: width - 140,
      y: height - 74,
      size: 10,
      font,
      color: ink,
    });
    page.drawText(`Issued ${formatDate(invoice.issue_date)}`, {
      x: width - 140,
      y: height - 88,
      size: 8,
      font,
      color: muted,
    });
    page.drawText(`Due ${formatDate(invoice.due_date)}`, {
      x: width - 140,
      y: height - 100,
      size: 8,
      font,
      color: muted,
    });

    // Bill To block
    page.drawText("BILL TO", {
      x: 48,
      y: height - 150,
      size: 8,
      font: bold,
      color: muted,
    });
    page.drawText(customer?.name ?? "Customer", {
      x: 48,
      y: height - 166,
      size: 11,
      font: bold,
      color: ink,
    });
    page.drawText(customer?.email ?? "", {
      x: 48,
      y: height - 180,
      size: 9,
      font,
      color: muted,
    });
    if (customer?.address) {
      page.drawText(customer.address.slice(0, 50), {
        x: 48,
        y: height - 194,
        size: 9,
        font,
        color: muted,
      });
    }
    if (customer?.tax_id) {
      page.drawText(`Tax ID: ${customer.tax_id}`, {
        x: 48,
        y: height - (customer?.address ? 208 : 194),
        size: 9,
        font,
        color: muted,
      });
    }

    // Status & Balance Due
    page.drawText("STATUS", {
      x: width - 140,
      y: height - 150,
      size: 8,
      font: bold,
      color: muted,
    });
    page.drawText(String(invoice.status || "OPEN").toUpperCase(), {
      x: width - 140,
      y: height - 166,
      size: 11,
      font: bold,
      color: ink,
    });

    const balanceDue = Number(invoice.total) - Number(invoice.amount_paid);
    page.drawText(`Balance due ${formatCurrency(balanceDue, currency)}`, {
      x: width - 140,
      y: height - 182,
      size: 8.5,
      font,
      color: muted,
    });
  };

  const drawTableHead = (yPos: number) => {
    page.drawRectangle({
      x: 48,
      y: yPos - 8,
      width: width - 96,
      height: 24,
      color: rgb(0.96, 0.96, 0.98),
    });
    page.drawText("DESCRIPTION", { x: 56, y: yPos, size: 8, font: bold, color: muted });
    page.drawText("QTY", { x: 380, y: yPos, size: 8, font: bold, color: muted });
    page.drawText("UNIT PRICE", { x: 420, y: yPos, size: 8, font: bold, color: muted });
    page.drawText("AMOUNT", { x: 500, y: yPos, size: 8, font: bold, color: muted });
  };

  // Draw Page 1 header
  drawFirstPageHeader();

  // Draw initial table header
  let y = height - 260;
  drawTableHead(y);
  y -= 28;

  // Render line items with pagination handling
  for (const item of items) {
    if (y < 80) {
      // Create new page
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      height = page.getSize().height;
      width = page.getSize().width;

      // Running header
      page.drawText(`${invoice.number} (continued)`, {
        x: 48,
        y: height - 40,
        size: 9,
        font: bold,
        color: muted,
      });
      page.drawLine({
        start: { x: 48, y: height - 48 },
        end: { x: width - 48, y: height - 48 },
        thickness: 0.5,
        color: line,
      });

      y = height - 76;
      drawTableHead(y);
      y -= 28;
    }

    const description = String(item.description || "Service item").slice(0, 62);
    page.drawText(description, { x: 56, y, size: 9.5, font: font, color: ink });
    page.drawText(String(item.quantity ?? 1), { x: 388, y, size: 9.5, font: font, color: ink });
    page.drawText(formatCurrency(Number(item.unit_price), currency), {
      x: 420,
      y,
      size: 9.5,
      font: font,
      color: ink,
    });
    page.drawText(formatCurrency(Number(item.amount), currency), {
      x: 500,
      y,
      size: 9.5,
      font: font,
      color: ink,
    });

    page.drawLine({
      start: { x: 48, y: y - 10 },
      end: { x: width - 48, y: y - 10 },
      thickness: 0.5,
      color: line,
    });
    y -= 28;
  }

  // Check if enough room for totals block
  if (y < 160) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    height = page.getSize().height;
    width = page.getSize().width;
    y = height - 60;
  }

  // Totals Section
  y -= 10;
  const totalsX = 370;
  const valueX = 500;

  page.drawText("Subtotal", { x: totalsX, y, size: 9, font, color: muted });
  page.drawText(formatCurrency(Number(invoice.subtotal), currency), {
    x: valueX,
    y,
    size: 9,
    font,
    color: ink,
  });
  y -= 18;

  if (Number(invoice.discount_total) > 0) {
    page.drawText("Discount", { x: totalsX, y, size: 9, font, color: muted });
    page.drawText(`-${formatCurrency(Number(invoice.discount_total), currency)}`, {
      x: valueX,
      y,
      size: 9,
      font,
      color: ink,
    });
    y -= 18;
  }

  page.drawText("Tax", { x: totalsX, y, size: 9, font, color: muted });
  page.drawText(formatCurrency(Number(invoice.tax_total), currency), {
    x: valueX,
    y,
    size: 9,
    font,
    color: ink,
  });
  y -= 24;

  page.drawLine({
    start: { x: totalsX, y: y + 8 },
    end: { x: width - 48, y: y + 8 },
    thickness: 0.7,
    color: line,
  });

  page.drawText("Total", { x: totalsX, y, size: 11, font: bold, color: ink });
  page.drawText(formatCurrency(Number(invoice.total), currency), {
    x: valueX,
    y,
    size: 11,
    font: bold,
    color: ink,
  });
  y -= 18;

  page.drawText("Amount paid", { x: totalsX, y, size: 9, font, color: muted });
  page.drawText(formatCurrency(Number(invoice.amount_paid), currency), {
    x: valueX,
    y,
    size: 9,
    font,
    color: ink,
  });

  // Notes block
  if (invoice.notes) {
    page.drawText("NOTES", { x: 48, y: y - 20, size: 8, font: bold, color: muted });
    page.drawText(String(invoice.notes).slice(0, 95), {
      x: 48,
      y: y - 36,
      size: 9,
      font,
      color: muted,
    });
  }

  // Footer on final page
  page.drawText("Thank you for your business.", { x: 48, y: 60, size: 9, font, color: muted });
  page.drawText(
    `${settings?.company_name ?? "Brightloop Software"} · ${settings?.support_email ?? "billing@brightloop.io"}`,
    {
      x: 48,
      y: 44,
      size: 8,
      font,
      color: muted,
    }
  );

  return await doc.save();
}
