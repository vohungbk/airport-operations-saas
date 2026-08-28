import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_ONLY_ROUTES,
  DASHBOARD_ROUTE,
  LOGIN_ROUTE,
  PUBLIC_ROUTES,
} from "@/lib/constants/routes";

/**
 * Copies the refreshed session cookies from the `NextResponse.next()`
 * built during session refresh onto a redirect response. Without this,
 * a redirect issued from the proxy would silently drop the just-refreshed
 * session cookies, breaking auth right after the refresh that produced
 * them.
 */
function withRefreshedCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

/**
 * Refreshes the Supabase auth session on every matched request. Next.js 16
 * renamed middleware.ts to proxy.ts; this helper is invoked from
 * src/proxy.ts, the current file convention for request-time session sync.
 *
 * Also enforces route protection at the proxy level: unauthenticated
 * requests to a non-public route are sent to /login, and authenticated
 * requests to a login/signup page are sent to the dashboard.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Revalidates the token with Supabase Auth on every request so expired
  // sessions are refreshed before they reach Server Components.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = !!data?.claims;

  const { pathname } = request.nextUrl;
  const isPublicRoute = (PUBLIC_ROUTES as readonly string[]).includes(
    pathname,
  );
  const isAuthOnlyRoute = (AUTH_ONLY_ROUTES as readonly string[]).includes(
    pathname,
  );

  if (!isAuthenticated && !isPublicRoute) {
    return withRefreshedCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(LOGIN_ROUTE, request.url)),
    );
  }

  if (isAuthenticated && isAuthOnlyRoute) {
    return withRefreshedCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(DASHBOARD_ROUTE, request.url)),
    );
  }

  return supabaseResponse;
}
