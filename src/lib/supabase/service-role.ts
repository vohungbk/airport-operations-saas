import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/config/env";
import { getServiceRoleKey } from "@/lib/config/server-env";
import type { Database } from "@/types/database.types";

/**
 * Server-only. The one client that bypasses RLS, for the system jobs that run with no signed-in user
 * (VI-F02-S03: the flight refresh). Its reason and its limits are in docs/security.md. Never import it
 * into a Client Component or use it to answer a request of a signed-in user: that is what `server.ts` is for.
 * It keeps no session.
 */
export function createServiceRoleClient() {
  const { supabase_url } = getPublicEnv();

  return createClient<Database>(supabase_url, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
