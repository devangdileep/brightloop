import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export interface LogActivityParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
}

/**
 * Log an audit action to public.activity_logs.
 * Uses the supplied client or falls back to admin client if service role is available.
 */
export async function logActivity(
  supabase: SupabaseClient | null,
  params: LogActivityParams
): Promise<void> {
  try {
    const client = supabase ?? createAdminClient();
    await client.from("activity_logs").insert({
      user_id: params.userId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      description: params.description ?? null,
    });
  } catch (error) {
    // Audit logging should not crash the main workflow if table isn't ready
    console.error("Failed to write audit activity log:", error);
  }
}
