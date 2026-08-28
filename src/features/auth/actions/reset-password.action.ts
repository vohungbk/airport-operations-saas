"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_ROUTE } from "@/lib/constants/routes";
import { resetPasswordSchema } from "@/features/auth/schemas/reset-password.schema";

export interface ResetPasswordActionResult {
  error: string;
}

export async function resetPasswordAction(
  input: unknown,
): Promise<ResetPasswordActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Check the form and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    // Covers both "no/expired recovery session" and unexpected failures
    // — the reset-password page's own guard (task 11) is the primary
    // place that catches an expired link before the form even renders.
    return {
      error: "Your reset link is invalid or has expired. Request a new one.",
    };
  }

  redirect(DASHBOARD_ROUTE);
}
