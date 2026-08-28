import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LOGIN_ROUTE } from "@/lib/constants/routes";

export interface AuthUser {
  id: string;
  email: string | undefined;
}

/**
 * Reads the current session's verified JWT claims. Returns `null` when
 * there is no session or the token is invalid/expired — callers decide
 * whether that's acceptable (public page) or not (`requireUser`).
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  return {
    id: data.claims.sub,
    email: data.claims.email,
  };
}

/**
 * Server Component / layout guard: redirects to `/login` when there is
 * no authenticated user. Complements the proxy-level redirect in
 * `src/lib/supabase/proxy.ts` — this is the last line of defense for a
 * Server Component rendered directly.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getAuthUser();

  if (!user) {
    redirect(LOGIN_ROUTE);
  }

  return user;
}
