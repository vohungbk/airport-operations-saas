import { PageForbidden } from "@/components/shared/page-state";
import { StandalonePage } from "@/components/shared/standalone-page";
import { TextLink } from "@/components/ui/text-link";
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
 * transient) write failure, not a permissions problem; and
 * `reason=no_partner`, for a partner user whose account is not linked to a
 * partner (VI-F03-S05); and `reason=partner_inactive`, for a partner user
 * whose partner is not active (VI-F03-S07, it does not say which status).
 * Those three values are the only ones recognized;
 * anything else (or nothing) falls back to the generic copy, so the query
 * string can't be used to inject arbitrary text.
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
  const isNoPartner = reason === "no_partner";
  const isPartnerInactive = reason === "partner_inactive";

  return (
    <StandalonePage>
      <PageForbidden
        title={
          isConfirmProfileFailure ? "Account setup incomplete" : undefined
        }
        description={
          isConfirmProfileFailure
            ? "Your email was confirmed, but we couldn't finish setting up your account. Please sign out and sign up again, or contact your administrator if this keeps happening."
            : isNoPartner
              ? "Your account is not linked to a partner yet, so there is nothing to show. Ask an administrator to link your account to your partner."
              : isPartnerInactive
                ? "Your organization's account is not active, so you cannot use the partner portal right now. Contact your administrator."
                : undefined
        }
      >
        {user ? (
          <LogoutButton />
        ) : (
          <TextLink href={LOGIN_ROUTE} className="text-sm">
            Sign in
          </TextLink>
        )}
      </PageForbidden>
    </StandalonePage>
  );
}
