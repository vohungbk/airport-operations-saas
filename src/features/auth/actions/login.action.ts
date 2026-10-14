"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_ROUTE } from "@/lib/constants/routes";
import {
  LOGIN_ERROR_MESSAGES,
  mapLoginError,
} from "@/features/auth/lib/login-errors";
import { loginSchema } from "@/features/auth/schemas/login.schema";

export interface LoginActionResult {
  error: string;
}

export async function loginAction(
  input: unknown,
): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  // A configuration error from `createClient()` should surface as such,
  // and `redirect()` throws, so both stay outside the try/catch below.
  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return { error: mapLoginError(error) };
    }
  } catch {
    return { error: LOGIN_ERROR_MESSAGES.unexpected };
  }

  redirect(DASHBOARD_ROUTE);
}
