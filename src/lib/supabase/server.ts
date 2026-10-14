import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/config/env";

/**
 * Server-side Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Cookie writes are wrapped in try/catch because Server
 * Components cannot set cookies — the session-refresh proxy handles that.
 */
export async function createClient() {
  const { supabase_url, supabase_publishable_key } = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    supabase_url,
    supabase_publishable_key,
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
            // Called from a Server Component — session refresh is handled
            // by the proxy instead.
          }
        },
      },
    },
  );
}
