import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabaseConfigured, serverSecrets } from "@/lib/config";

/** Client acting as the logged-in user (RLS applies). */
export async function createClient() {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Anonymous client without cookies — for public, cacheable reads. */
export function createPublicClient() {
  if (!isSupabaseConfigured) return null;
  return createJsClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client. BYPASSES RLS — use only in server code after checking
 * who the caller is (payments, webhooks, downloads).
 */
export function createServiceClient() {
  const key = serverSecrets().supabaseServiceKey;
  if (!SUPABASE_URL || !key) throw new Error("Supabase service key is not configured");
  return createJsClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
