import { createClient } from "@supabase/supabase-js";

/**
 * A client with the server-only secret key, for requests with no signed-in
 * admin (the intake API and public submission form). It bypasses RLS, so only
 * call the intake_* functions with it: they check the caller's credential
 * themselves. Null when SUPABASE_SECRET_KEY isn't set.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
