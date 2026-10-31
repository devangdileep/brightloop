import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/utils";

async function determineRoleHome(supabase: Awaited<ReturnType<typeof createClient>>, defaultNext: string) {
  if (defaultNext && defaultNext !== "/dashboard") {
    return defaultNext;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/dashboard";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") return "/admin/dashboard";
  if (profile?.role === "staff") return "/staff/dashboard";
  return "/portal/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeRedirect(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = await determineRoleHome(supabase, next);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email" | "recovery" | "invite" | "magiclink",
    });
    if (!error) {
      const destination = await determineRoleHome(supabase, next);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
