import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";
import { getPartnerAccessIssue } from "@/lib/auth/partner-scope";
import type { PartnerStatus } from "@/features/partners/types";
import {
  FORBIDDEN_ROUTE,
  LOGIN_ROUTE,
  NO_PARTNER_ROUTE,
  PARTNER_INACTIVE_ROUTE,
} from "@/lib/constants/routes";

/** PostgREST code for `.single()` finding no row. */
const NO_ROW_ERROR_CODE = "PGRST116";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  partner_id: string | null;
  /**
   * The status of the partner, `null` when there is no partner or it could not
   * be read (the database hides a partner that is not active from its users).
   */
  partner_status: PartnerStatus | null;
  is_active: boolean;
}

/**
 * Resolves the full app-level profile for the current session: verifies
 * the JWT via `getAuthUser()`, then does a single self-lookup row read on
 * `public.users` keyed by the caller's own verified id (never a list
 * query). Safe without RLS specifically because it is scoped to
 * `auth.uid()` of the caller — see `docs/security.md`. A failed read (not a
 * missing row) throws instead of returning `null`. Wrapped in
 * `cache()` so nested layouts (e.g. `(dashboard)` then `(admin)`) share
 * one DB round trip per request instead of one each.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const authUser = await getAuthUser();

  if (!authUser) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, full_name, role, partner_id, is_active, partner:partners(status)",
    )
    .eq("id", authUser.id)
    .single();

  // "No such row" is a missing profile: not permitted. Any other error (the
  // network, the database) says nothing about permission, so it must not be
  // reported as "forbidden": it is thrown for the error boundary to offer a
  // retry. It never grants access.
  if (error && error.code !== NO_ROW_ERROR_CODE) {
    throw new Error("Could not read the user profile");
  }

  if (!data || !data.is_active) {
    return null;
  }

  const { partner, ...profile } = data as typeof data & {
    partner: { status: PartnerStatus } | null;
  };

  return { ...profile, partner_status: partner?.status ?? null };
});

/**
 * Server Component / layout guard: no session -> `/login`; session but
 * missing/inactive/invalid `public.users` profile -> `/forbidden` (never
 * leaks which case it is). A partner user with no partner, or whose partner
 * is not active -> `/forbidden` with the reason `no_partner` (VI-F03-S05, spec
 * E2) or `partner_inactive` (VI-F03-S07, spec E1): this is the one place every
 * signed-in area goes through, so the rule holds for each present and future
 * route and on every request (a partner deactivated while the user is signed
 * in is refused at the next one), and it is read from the profile and the
 * partner row, never from the request. Returns the resolved `AppUser`
 * otherwise.
 */
export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser();

  if (user) {
    const issue = getPartnerAccessIssue(user);

    if (issue === "no_partner") {
      redirect(NO_PARTNER_ROUTE);
    }

    if (issue === "partner_inactive") {
      redirect(PARTNER_INACTIVE_ROUTE);
    }

    return user;
  }

  // getCurrentUser() returns null for both "no session" and "invalid
  // profile" - re-check the JWT alone (cheap, no DB round trip) only on
  // this failure path to pick the right redirect target.
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect(LOGIN_ROUTE);
  }

  redirect(FORBIDDEN_ROUTE);
}

/**
 * `admin` bypasses every role check — the only place this bypass is
 * implemented. Never re-implement `role === "admin"` inline in a
 * layout/page.
 */
export async function requireRole(allowed: Role[]): Promise<AppUser> {
  const user = await requireAuth();

  if (user.role !== "admin" && !allowed.includes(user.role)) {
    redirect(FORBIDDEN_ROUTE);
  }

  return user;
}

/**
 * `admin` bypasses every permission check via `hasPermission()`'s own
 * short-circuit — no separate bypass here.
 */
export async function requirePermission(
  permission: Permission,
): Promise<AppUser> {
  const user = await requireAuth();

  if (!hasPermission(user.role, permission)) {
    redirect(FORBIDDEN_ROUTE);
  }

  return user;
}

/**
 * Any-of variant for routes shared by roles with different permissions
 * (e.g. `/bookings`: `bookings:manage` or `bookings:view_own_partner`).
 * `admin` still passes through `hasPermission()`'s own short-circuit.
 */
export async function requireAnyPermission(
  permissions: readonly Permission[],
): Promise<AppUser> {
  const user = await requireAuth();

  if (!hasAnyPermission(user.role, permissions)) {
    redirect(FORBIDDEN_ROUTE);
  }

  return user;
}

/**
 * For the pages of the partner portal itself (`/partner`, `/partner/seats`):
 * the permission check, and a partner that is not null. The partner is the one
 * on the signed-in user's own profile, so it is what a page reads for, never a
 * value from the address. A user with no partner (an admin or manager opening
 * the portal, for example) is sent to the same no-partner page.
 */
export async function requirePartnerScope(
  permission: Permission,
): Promise<AppUser & { partner_id: string }> {
  const user = await requirePermission(permission);

  if (user.partner_id === null) {
    redirect(NO_PARTNER_ROUTE);
  }

  return { ...user, partner_id: user.partner_id };
}
