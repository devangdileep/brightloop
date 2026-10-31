import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "email";
  const next = safeRedirect(searchParams.get("next"));

  if (!tokenHash) return NextResponse.redirect(`${origin}/login?error=missing_token`);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "email" | "recovery" | "invite" | "magiclink",
  });

  if (error) return NextResponse.redirect(`${origin}/login?error=verification_failed`);
  return NextResponse.redirect(`${origin}${next}`);
}
