"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_ROUTE } from "@/lib/constants/routes";
import { signupSchema } from "@/features/auth/schemas/signup.schema";

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
  const { data, error } = await supabase.auth.signUp({ email, password });

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

  if (!isObfuscatedExistingUser) {
    // Hardcoded server-side: role/partner_id are never read from client
    // input. Upsert by id so a retried/interrupted signup can't leave a
    // duplicate or a broken row behind.
    const { error: profileError } = await supabase.from("users").upsert(
      {
        id: data.user.id,
        email,
        full_name,
        role: "partner_user",
        partner_id: null,
      },
      { onConflict: "id" },
    );

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
