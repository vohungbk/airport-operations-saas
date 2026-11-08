/**
 * Route constants shared between the session-refresh proxy
 * (`src/lib/supabase/proxy.ts`) and auth pages/actions, so the list of
 * public routes and the post-login destination are defined in one place.
 */

export const LOGIN_ROUTE = "/login";

export const DASHBOARD_ROUTE = "/dashboard";

/**
 * Where every sign-in lands: the root page, which sends each person to the home
 * of their role (`getHomeRouteForRole`). Login, signup, email confirmation,
 * password reset and the proxy all use it, so the one rule works for each.
 */
export const HOME_ROUTE = "/";

/**
 * The query parameter of the sign in page that holds the page to return to after
 * signing in (FO-F03-S11). Its value is never trusted: see `safeNextPath`.
 */
export const RETURN_TO_PARAM = "next";

/**
 * The home of a partner user. Every sign-in lands on `/` (`HOME_ROUTE`), which
 * sends a partner user here.
 */
export const PARTNER_HOME_ROUTE = "/partner";

/** The Workflow Board (CO-F08-S01); the menu item "Workflow Board" opens it. */
export const WORKFLOW_BOARD_ROUTE = "/admin";

/** The Workflow Board of a technician (CO-F08-T02): the bookings of their own jobs, by step. */
export const TECHNICIAN_WORKFLOW_ROUTE = "/technician/workflow";

/** The home of a technician: the jobs of the day. */
export const TECHNICIAN_HOME_ROUTE = "/technician";

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
 * Where a partner user is sent when their partner is not active (VI-F03-S07,
 * spec E1): the same forbidden page, with one fixed reason. It does not say
 * which status the partner has.
 */
export const PARTNER_INACTIVE_ROUTE = `${FORBIDDEN_ROUTE}?reason=partner_inactive`;

/**
 * Routes reachable without an authenticated session. `/` stays public to the
 * proxy; the page itself sends a signed-out visitor to `/login` and a signed-in
 * user to the home of their role. `/api/auth/confirm` is the email
 * confirmation / recovery callback — it must be reachable while signed
 * out since that's exactly when it's used. `/api/flights/refresh` is called by a
 * scheduler, not a person (VI-F02-S03): the proxy lets it through and the route
 * itself refuses a request that has no valid `CRON_SECRET`.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth/confirm",
  "/api/flights/refresh",
] as const;

/**
 * Routes an already-authenticated user should be redirected away from
 * (back to the dashboard) instead of seeing the auth forms again.
 */
export const AUTH_ONLY_ROUTES = ["/login", "/signup"] as const;

/**
 * The path a seat QR code opens (CO-F04-S12): `/q/<public_token>`. The page behind it is the
 * story "Open Seat From QR" (CO-F04-S13); until it is built a scan gives a not-found page.
 */
export const SEAT_QR_PATH_PREFIX = "/q";

/** The ROI dashboard of a partner user (VI-F05-S04), and the Baseline inputs screen under it (VI-F05-S05). */
export const PARTNER_ROI_ROUTE = "/partner/roi";
export const PARTNER_BASELINE_ROUTE = "/partner/roi/baseline";
