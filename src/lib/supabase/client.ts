import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/config/env";

export function createClient() {
  const { supabase_url, supabase_publishable_key } = getPublicEnv();

  return createBrowserClient(
    supabase_url,
    supabase_publishable_key,
  );
}
