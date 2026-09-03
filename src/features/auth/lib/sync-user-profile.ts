import type { createClient } from "@/lib/supabase/server";

export interface SyncUserProfileInput {
  id: string;
  email: string;
  full_name: string;
}

/**
 * Upserts the `public.users` profile row for a confirmed Supabase Auth
 * user. Must only be called with a server client whose session's
 * `auth.uid()` equals `id` — the RLS INSERT policy on `public.users`
 * requires `id = auth.uid()`, so this write is rejected by the database
 * for any other caller (F05). Shared by the two call sites where
 * `auth.uid()` is guaranteed to be the real new user's id:
 * `signup.action.ts` (email confirmation disabled, session returned
 * immediately by `signUp()`) and `api/auth/confirm/route.ts` (email
 * confirmation enabled, after the confirmation token is exchanged for a
 * session).
 *
 * Hardcodes `role`/`partner_id` — never accepts them as input, so no
 * caller can turn this into a privilege-escalation path.
 */
export async function syncUserProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { id, email, full_name }: SyncUserProfileInput,
) {
  return supabase.from("users").upsert(
    {
      id,
      email,
      full_name,
      role: "partner_user",
      partner_id: null,
    },
    { onConflict: "id" },
  );
}
