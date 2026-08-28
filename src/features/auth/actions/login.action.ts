"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_ROUTE } from "@/lib/constants/routes";
import { loginSchema } from "@/features/auth/schemas/login.schema";

export interface LoginActionResult {
  error: string;
}

function mapLoginError(error: AuthError): string {
  if (error.code === "email_not_confirmed") {
    return "Please confirm your email address before signing in.";
  }

  // Never distinguish "wrong password" from "no such account" here.
  return "Invalid email or password.";
}

export async function loginAction(
  input: unknown,
): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: mapLoginError(error) };
  }

  redirect(DASHBOARD_ROUTE);
}
