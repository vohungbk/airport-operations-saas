import Link from "next/link";

import { getAuthUser } from "@/lib/auth/session";
import { LOGIN_ROUTE } from "@/lib/constants/routes";
import { LogoutButton } from "@/features/auth/components/logout-button";

interface ForbiddenPageProps {
  searchParams: Promise<{ reason?: string }>;
}

/**
 * Shared page for "authenticated but not permitted", "invalid/missing
 * profile", and (new) "email confirmed but profile setup failed" cases
 * (`requireAuth`/`requireRole`/`requirePermission` in
 * `src/lib/auth/current-user.ts`, and `api/auth/confirm/route.ts`).
 * Deliberately generic, non-leaking copy by default that doesn't confirm
 * which permission/profile case occurred — the one exception is
 * `reason=confirm_profile_failed`, a specific, accurate message for a
 * caller who just confirmed their email and hit a real (likely
 * transient) write failure, not a permissions problem. That value is the
 * only one recognized; anything else (or nothing) falls back to the
 * generic copy, so the query string can't be used to inject arbitrary
 * text.
 *
 * Must NOT call `requireAuth()` — that's exactly the redirect-loop risk
 * this page exists to be a safe landing spot for. Uses `getAuthUser()`
 * (JWT-only, no `public.users` round trip) only to decide whether to
 * show a logout link or a login link.
 */
export default async function ForbiddenPage({
  searchParams,
}: ForbiddenPageProps) {
  const [user, { reason }] = await Promise.all([getAuthUser(), searchParams]);
  const isConfirmProfileFailure = reason === "confirm_profile_failed";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {isConfirmProfileFailure ? "Account setup incomplete" : "Access denied"}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {isConfirmProfileFailure
          ? "Your email was confirmed, but we couldn't finish setting up your account. Please sign out and sign up again, or contact your administrator if this keeps happening."
          : "You don't have permission to view this page. If you think this is a mistake, contact your administrator."}
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
