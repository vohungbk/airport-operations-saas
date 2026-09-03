"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_ROUTE } from "@/lib/constants/routes";
import { signupSchema } from "@/features/auth/schemas/signup.schema";
import { syncUserProfile } from "@/features/auth/lib/sync-user-profile";

export interface SignupActionResult {
  success: boolean;
  message: string;
}

/**
 * Message shown both for a genuinely new signup pending confirmation and
 * for a duplicate-email signup (obfuscated by Supabase as `identities:
 * []`) — the two must be indistinguishable to avoid email enumeration.
 */
const CHECK_EMAIL_MESSAGE =
  "Check your email to confirm your account before signing in.";

function mapSignupError(error: AuthError): string {
  if (error.code === "weak_password") {
    return "Password is too weak. Choose a stronger password.";
  }

  if (error.code === "user_already_exists") {
    // Same message as a real pending signup — don't leak that the email
    // is already registered.
    return CHECK_EMAIL_MESSAGE;
  }

  return "Something went wrong. Please try again.";
}

export async function signupAction(
  input: unknown,
): Promise<SignupActionResult> {
  const parsed = signupSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Check the form and try again." };
  }

  const { email, full_name, password } = parsed.data;

  const supabase = await createClient();
  // full_name is stashed in Auth user_metadata so api/auth/confirm/route.ts
  // can read it back after email confirmation, when this request/closure
  // no longer exists — see src/features/auth/lib/sync-user-profile.ts.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });

  if (error) {
    const message = mapSignupError(error);
    return { success: message === CHECK_EMAIL_MESSAGE, message };
  }

  if (!data.user) {
    return {
      success: false,
      message: "Something went wrong. Please try again.",
    };
  }

  // `identities: []` is Supabase's obfuscated response for an existing
  // (already-registered) email when email confirmation is required —
  // treat it exactly like a fresh pending signup, and never write to
  // public.users for it (it isn't actually a new user).
  const isObfuscatedExistingUser = data.user.identities?.length === 0;

  // A session is only returned here when email confirmation is disabled —
  // auth.uid() is already the real new user's id, so the RLS INSERT
  // policy on public.users (`id = auth.uid()`) allows this write. When
  // email confirmation is enabled, signUp() returns no session and this
  // branch must not run (it would execute as `anon` with no auth.uid());
  // api/auth/confirm/route.ts performs the equivalent upsert after the
  // confirmation token is exchanged for a real session instead.
  if (!isObfuscatedExistingUser && data.session) {
    const { error: profileError } = await syncUserProfile(supabase, {
      id: data.user.id,
      email,
      full_name,
    });

    if (profileError) {
      return {
        success: false,
        message: "Something went wrong. Please try again.",
      };
    }
  }

  if (data.session) {
    redirect(DASHBOARD_ROUTE);
  }

  return { success: true, message: CHECK_EMAIL_MESSAGE };
}
