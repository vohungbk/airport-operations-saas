import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { AuthError } from "@supabase/supabase-js";

export const LOGIN_ERROR_MESSAGES = {
  invalid_credentials: "Invalid email or password.",
  email_not_confirmed: "Please confirm your email address before signing in.",
  network:
    "We could not reach the sign-in service. Check your connection and try again.",
  rate_limited: "Too many sign-in attempts. Wait a moment and try again.",
  unexpected: "Something went wrong. Try again.",
} as const;

/**
 * Maps a Supabase Auth error to a user-facing sign-in message. Rate
 * limiting itself is enforced by Supabase Auth; this only reports it.
 */
export function mapLoginError(error: AuthError): string {
  if (isAuthRetryableFetchError(error)) {
    return LOGIN_ERROR_MESSAGES.network;
  }

  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return LOGIN_ERROR_MESSAGES.rate_limited;
  }

  if (error.code === "email_not_confirmed") {
    return LOGIN_ERROR_MESSAGES.email_not_confirmed;
  }

  // Never distinguish "wrong password" from "no such account" here.
  return LOGIN_ERROR_MESSAGES.invalid_credentials;
}

function isRedirectError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/**
 * Runs the sign-in Server Action from the client and returns an error
 * message, or `null` on success. A successful sign-in redirects, which
 * Next.js reports to the caller as a rejected promise — that is
 * re-thrown so navigation still happens. Any other rejection (for
 * example the browser being offline) becomes a retryable network message.
 */
export async function submitLogin<TValues>(
  login: (values: TValues) => Promise<{ error: string } | void>,
  values: TValues,
): Promise<string | null> {
  try {
    const result = await login(values);
    return result?.error ?? null;
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return LOGIN_ERROR_MESSAGES.network;
  }
}
