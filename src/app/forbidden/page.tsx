import Link from "next/link";

import { getAuthUser } from "@/lib/auth/session";
import { LOGIN_ROUTE } from "@/lib/constants/routes";
import { LogoutButton } from "@/features/auth/components/logout-button";

/**
 * Shared page for both "authenticated but not permitted" and
 * "invalid/missing profile" cases (`requireAuth`/`requireRole`/
 * `requirePermission` in `src/lib/auth/current-user.ts`) — deliberately
 * generic, non-leaking copy that doesn't confirm which case occurred.
 *
 * Must NOT call `requireAuth()` — that's exactly the redirect-loop risk
 * this page exists to be a safe landing spot for. Uses `getAuthUser()`
 * (JWT-only, no `public.users` round trip) only to decide whether to
 * show a logout link or a login link.
 */
export default async function ForbiddenPage() {
  const user = await getAuthUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Access denied
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        You don&apos;t have permission to view this page. If you think this
        is a mistake, contact your administrator.
      </p>
      {user ? (
        <LogoutButton />
      ) : (
        <Link
          href={LOGIN_ROUTE}
          className="text-sm underline underline-offset-4 hover:text-foreground"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
