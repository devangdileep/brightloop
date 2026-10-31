// Supabase Edge Function: generate-invoice-pdf
// Generates, stores, and streams invoice PDFs directly from the backend.
// Deploy: supabase functions deploy generate-invoice-pdf --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generateInvoicePdf } from "../_shared/invoice-pdf.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (request) => {
  // CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (request.method !== "POST" && request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("BILLING_CRON_SECRET");

  if (!serviceKey) {
    return json({ error: "Service role key missing from environment" }, 500);
  }

  // Parse parameters
  const url = new URL(request.url);
  let invoiceId = url.searchParams.get("invoice_id") ?? url.searchParams.get("id");
  let wantDownload = url.searchParams.get("download") === "true" ||
    request.headers.get("accept")?.includes("application/pdf");
  let force = url.searchParams.get("force") === "true";
  let persist = url.searchParams.get("persist") !== "false";

  if (request.method === "POST") {
    try {
      const body = await request.json();
      invoiceId = body.invoice_id ?? body.id ?? invoiceId;
      if (body.download !== undefined) wantDownload = Boolean(body.download);
      if (body.force !== undefined) force = Boolean(body.force);
      if (body.persist !== undefined) persist = Boolean(body.persist);
    } catch {
      // Body may be empty if params provided in URL
    }
  }

  if (!invoiceId) {
    return json({ error: "Missing required parameter: invoice_id" }, 400);
  }

  // Verify authentication
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const isServerSecret = (cronSecret && token === cronSecret) || token === serviceKey;
  let callerUserId: string | null = null;
  let callerRole: string | null = null;

  // Create admin client for storage writes and system overrides
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  if (!isServerSecret) {
    if (!token) {
      return json({ error: "Unauthorized: Missing authentication token" }, 401);
    }

    // Verify user JWT
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return json({ error: "Unauthorized: Invalid JWT" }, 401);
    }
    callerUserId = user.id;

    // Fetch user profile role
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerUserId)
      .maybeSingle();

    callerRole = profile?.role ?? "customer";
  } else {
    callerRole = "admin";
  }

  // Query invoice with customer and line items
  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("*, customer:customers(*), items:invoice_items(*)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return json({ error: invoiceError.message }, 500);
  }

  if (!invoice) {
    return json({ error: "Invoice not found" }, 404);
  }

  // If caller is customer, verify they own this invoice
  if (callerRole === "customer" && invoice.customer?.user_id !== callerUserId) {
    return json({ error: "Forbidden: You do not have access to this invoice" }, 403);
  }

  const path = `invoices/${invoice.customer_id}/${invoice.id}.pdf`;

  // 1. Check if already stored and cached in Supabase Storage
  if (invoice.pdf_path && !force) {
    const { data: fileData, error: fileError } = await adminClient.storage
      .from("documents")
      .download(invoice.pdf_path);

    if (!fileError && fileData) {
      const fileBytes = new Uint8Array(await fileData.arrayBuffer());
      if (wantDownload) {
        return pdfResponse(fileBytes, `${invoice.number}.pdf`);
      }

      // Generate signed URL
      const { data: signedData } = await adminClient.storage
        .from("documents")
        .createSignedUrl(invoice.pdf_path, 3600);

      return json({
        ok: true,
        cached: true,
        invoice_id: invoice.id,
        number: invoice.number,
        pdf_path: invoice.pdf_path,
        download_url: signedData?.signedUrl ?? null,
      });
    }
  }

  // 2. Fetch app settings for company branding
  const { data: settings } = await adminClient
    .from("app_settings")
    .select("company_name, support_email, currency, address")
    .eq("id", 1)
    .maybeSingle();

  // 3. Generate the PDF
  const items = (invoice.items ?? []) as Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;

  const pdfBytes = await generateInvoicePdf({
    invoice,
    customer: invoice.customer,
    items,
    settings,
  });

  // 4. Persist to storage (only if server secret or staff/admin, or explicitly requested)
  let storedPath = invoice.pdf_path;
  if (persist && (isServerSecret || callerRole === "admin" || callerRole === "staff")) {
    const { error: uploadError } = await adminClient.storage
      .from("documents")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!uploadError) {
      storedPath = path;
      await adminClient
        .from("invoices")
        .update({ pdf_path: path })
        .eq("id", invoice.id);
    }
  }

  // 5. Return response
  if (wantDownload) {
    return pdfResponse(pdfBytes, `${invoice.number}.pdf`);
  }

  let downloadUrl: string | null = null;
  if (storedPath) {
    const { data: signedData } = await adminClient.storage
      .from("documents")
      .createSignedUrl(storedPath, 3600);
    downloadUrl = signedData?.signedUrl ?? null;
  }

  return json({
    ok: true,
    cached: false,
    invoice_id: invoice.id,
    number: invoice.number,
    pdf_path: storedPath,
    download_url: downloadUrl,
  });
});
