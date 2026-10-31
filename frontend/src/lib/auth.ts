import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile, UserRole } from "@/types";

type Session =
  | { supabase: null; user: null; profile: null }
  | { supabase: SupabaseClient; user: User | null; profile: Profile | null; }

type AuthenticatedSession = {
  supabase: SupabaseClient;
  user: User;
  profile: Profile;
};

export async function getSessionProfile(): Promise<Session> {
  if (!isSupabaseConfigured()) {
    return { supabase: null, user: null, profile: null };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, profile: null };

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  const profile: Profile =
    data ??
    ({
      id: user.id,
      email: user.email ?? "",
      full_name: (user.user_metadata?.full_name as string) ?? user.email ?? null,
      role: "customer" as UserRole,
      avatar_url: null,
      phone: null,
      created_at: user.created_at,
    } satisfies Profile);

  return { supabase, user, profile };
}

export async function requireProfile(): Promise<AuthenticatedSession> {
  const session = await getSessionProfile();
  if (!session.supabase || !session.user || !session.profile) redirect("/login");
  return {
    supabase: session.supabase,
    user: session.user,
    profile: session.profile,
  };
}

export async function requireStaff(): Promise<AuthenticatedSession> {
  const session = await requireProfile();
  if (session.profile.role === "customer") redirect("/dashboard/portal");
  return session;
}

export async function requireAdmin(): Promise<AuthenticatedSession> {
  const session = await requireProfile();
  if (session.profile.role !== "admin") redirect("/dashboard");
  return session;
}

export function canManage(role: UserRole | undefined) {
  return role === "admin" || role === "staff";
}

export function isAdmin(role: UserRole | undefined) {
  return role === "admin";
}
