import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Create a new client per request; don't share one across requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: the proxy refreshes the session.
          }
        },
      },
    },
  );
}

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
  /** A demo account: read-only access to the demo hackathons (see lib/demo.ts). */
  demo: boolean;
};

/**
 * The signed-in admin, read from the verified session claims. The name comes
 * from user_metadata.display_name, so it's display-only (users can edit their
 * own metadata) and updates when the session token next refreshes. `demo`
 * comes from app_metadata, which only the server can set.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const { email, user_metadata: meta, app_metadata: app } = data.claims;
  const name = typeof meta?.display_name === "string" ? meta.display_name.trim() : "";
  return {
    id: data.claims.sub,
    email: typeof email === "string" ? email : null,
    name: name || null,
    demo: app?.demo === true,
  };
}
