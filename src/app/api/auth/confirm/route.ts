import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_ROUTE, LOGIN_ROUTE } from "@/lib/constants/routes";

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
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (type === "recovery") {
      // Whether verifyOtp succeeded or not, the reset-password page's own
      // server-side guard (checks for a live recovery session) decides
      // whether to render the form or an "invalid/expired link" state.
      redirect(RESET_PASSWORD_ROUTE);
    }

    if (!error) {
      redirect(DASHBOARD_ROUTE);
    }
  }

  redirect(LOGIN_ROUTE);
}
