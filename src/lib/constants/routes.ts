/**
 * Route constants shared between the session-refresh proxy
 * (`src/lib/supabase/proxy.ts`) and auth pages/actions, so the list of
 * public routes and the post-login destination are defined in one place.
 */

export const LOGIN_ROUTE = "/login";

export const DASHBOARD_ROUTE = "/dashboard";

/**
 * Routes reachable without an authenticated session. `/` is the F01
 * landing page and stays public. `/api/auth/confirm` is the email
 * confirmation / recovery callback — it must be reachable while signed
 * out since that's exactly when it's used.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth/confirm",
] as const;

/**
 * Routes an already-authenticated user should be redirected away from
 * (back to the dashboard) instead of seeing the auth forms again.
 */
export const AUTH_ONLY_ROUTES = ["/login", "/signup"] as const;
