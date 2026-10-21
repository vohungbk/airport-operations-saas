/**
 * Route constants shared between the session-refresh proxy
 * (`src/lib/supabase/proxy.ts`) and auth pages/actions, so the list of
 * public routes and the post-login destination are defined in one place.
 */

export const LOGIN_ROUTE = "/login";

export const DASHBOARD_ROUTE = "/dashboard";

/**
 * The home of a partner user. Every sign-in lands on `/dashboard`, which sends
 * a partner user here, so the one rule works for login, signup, email
 * confirmation and password reset alike.
 */
export const PARTNER_HOME_ROUTE = "/partner";

/**
 * Shown for both "authenticated but not permitted" (role/permission
 * check failed) and "invalid/missing profile" (session exists but
 * `public.users` row is missing/inactive) — see
 * `src/lib/auth/current-user.ts`. Intentionally not in `PUBLIC_ROUTES`:
 * only an already-authenticated user is ever redirected here, so it
 * never needs to be reachable from the proxy's unauthenticated branch.
 */
export const FORBIDDEN_ROUTE = "/forbidden";

/**
 * Where a partner user with no partner is sent (VI-F03-S05, spec E2): the same
 * forbidden page, with a reason that says what is missing. The reason is one
 * fixed value the page recognizes; nothing else in the query is trusted.
 */
export const NO_PARTNER_ROUTE = `${FORBIDDEN_ROUTE}?reason=no_partner`;

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
