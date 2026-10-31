import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./config";

/**
 * Service-role client. Only import this from trusted server code
 * (server actions, route handlers, edge functions). Never send the key
 * or this client to the browser.
 */
export function createAdminClient() {
  const env = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceKey) {
    throw new Error("Supabase service role is not configured (SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createSupabaseClient(env.url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
