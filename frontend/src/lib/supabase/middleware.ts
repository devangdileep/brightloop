import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./config";

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/dashboard");
  const isAuthRoute = ["/login", "/register", "/forgot-password", "/reset-password"].includes(pathname);

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.status === "inactive" || profile?.status === "suspended") {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "error=account_deactivated";
      return NextResponse.redirect(url);
    }

    const role = profile?.role ?? "customer";
    const roleHome =
      role === "admin"
        ? "/admin/dashboard"
        : role === "staff"
        ? "/staff/dashboard"
        : "/portal/dashboard";

    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome;
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      const url = request.nextUrl.clone();
      url.pathname = roleHome;
      return NextResponse.redirect(url);
    }

    // Role-based route enforcement
    if (role === "customer" && (pathname.startsWith("/admin") || pathname.startsWith("/staff"))) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/dashboard";
      return NextResponse.redirect(url);
    }

    if (role === "staff" && pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/staff/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
