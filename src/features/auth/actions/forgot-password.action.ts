"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/features/auth/schemas/forgot-password.schema";

export interface ForgotPasswordActionResult {
  success: boolean;
  message: string;
}

/**
 * Always the same message, whether or not the email exists — this is
 * the anti-enumeration guarantee for the forgot-password flow.
 */
const GENERIC_SUCCESS_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

export async function forgotPasswordAction(
  input: unknown,
): Promise<ForgotPasswordActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Enter a valid email address." };
  }

  const headersList = await headers();
  const origin =
    headersList.get("origin") ?? `https://${headersList.get("host")}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/api/auth/confirm`,
  });

  // Intentionally ignore the error — surfacing it would let a caller
  // distinguish "email exists but send failed" from "no such email".
  return { success: true, message: GENERIC_SUCCESS_MESSAGE };
}
