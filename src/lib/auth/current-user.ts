import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";
import { FORBIDDEN_ROUTE, LOGIN_ROUTE } from "@/lib/constants/routes";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  partner_id: string | null;
  is_active: boolean;
}

/**
 * Resolves the full app-level profile for the current session: verifies
 * the JWT via `getAuthUser()`, then does a single self-lookup row read on
 * `public.users` keyed by the caller's own verified id (never a list
 * query). Safe without RLS specifically because it is scoped to
 * `auth.uid()` of the caller — see `docs/security.md`. Wrapped in
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
    .select("id, email, full_name, role, partner_id, is_active")
    .eq("id", authUser.id)
    .single();

  if (error || !data || !data.is_active) {
    return null;
  }

  return data;
});

/**
 * Server Component / layout guard: no session -> `/login`; session but
 * missing/inactive/invalid `public.users` profile -> `/forbidden` (never
 * leaks which case it is). Returns the resolved `AppUser` otherwise.
 */
export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser();

  if (user) {
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
