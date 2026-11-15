import { requireAuth, type AppUser } from "@/lib/auth/current-user";
import { BOOKINGS_IMPORT_PERMISSIONS, hasAnyPermission } from "@/lib/auth/permissions";

/**
 * Server-only. CO-F07-S13 (E10): the role is read again on every import action, because it can change while
 * the screen is open. A user who lost the import permission gets `null`, so the action can answer with a
 * forbidden state and the screen keeps what the user entered; `forbidden()` would throw the user out of it.
 * A user who is not signed in is still sent to the sign-in page by `requireAuth`.
 */
export async function authorizeBookingImport(): Promise<AppUser | null> {
  const user = await requireAuth();

  return hasAnyPermission(user.role, BOOKINGS_IMPORT_PERMISSIONS) ? user : null;
}
