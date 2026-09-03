import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import {
  DASHBOARD_ROUTE,
  FORBIDDEN_ROUTE,
  LOGIN_ROUTE,
} from "@/lib/constants/routes";
import { syncUserProfile } from "@/features/auth/lib/sync-user-profile";

const RESET_PASSWORD_ROUTE = "/reset-password";

/**
 * Exchanges the `token_hash`/`type` pair from a signup-confirmation or
 * password-recovery email link for a session, then redirects. A Route
 * Handler (not a Server Action) because it's reached via a GET link
 * clicked from an email, not a form submission.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (type === "recovery") {
      // Whether verifyOtp succeeded or not, the reset-password page's own
      // server-side guard (checks for a live recovery session) decides
      // whether to render the form or an "invalid/expired link" state.
      redirect(RESET_PASSWORD_ROUTE);
    }

    if (!error && data.user) {
      if (type === "signup") {
        // auth.uid() is now the real confirmed user's id — the RLS
        // INSERT policy on public.users (`id = auth.uid()`) allows this
        // write. Mirrors the session-immediately branch in
        // signup.action.ts for the email-confirmation-enabled case,
        // where that branch can't run (no session/auth.uid() yet at
        // signup time). full_name comes from the user_metadata stashed
        // there by signUp()'s `options.data`.
        const { error: profileError } = await syncUserProfile(supabase, {
          id: data.user.id,
          email: data.user.email ?? "",
          full_name:
            typeof data.user.user_metadata?.full_name === "string"
              ? data.user.user_metadata.full_name
              : "",
        });

        if (profileError) {
          // The confirmation token is single-use and already consumed by
          // verifyOtp() above, so there is no way to retry this exact
          // link. Land on /forbidden with a specific reason instead of
          // silently proceeding to /dashboard, where requireAuth() would
          // otherwise bounce this same user with the generic "access
          // denied" copy and no explanation. No email/full_name in the
          // log - just the (non-PII) auth user id and the DB error.
          console.error(
            "api/auth/confirm: failed to write public.users profile after email confirmation",
            { userId: data.user.id, error: profileError },
          );
          redirect(`${FORBIDDEN_ROUTE}?reason=confirm_profile_failed`);
        }
      }

      redirect(DASHBOARD_ROUTE);
    }
  }

  redirect(LOGIN_ROUTE);
}
