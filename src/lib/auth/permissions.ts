import type { Role } from "@/lib/auth/roles";

/**
 * The full permission model. Matches the ticket's role/permission table
 * exactly — do not invent additional permissions (e.g. per-area `*:access`
 * grants; nav/route guards reuse these business permissions instead, see
 * `src/config/nav.ts`).
 */
export type Permission =
  | "airports:manage"
  | "partners:manage"
  | "seats:manage"
  | "bookings:manage"
  | "technicians:manage"
  | "cleaning:manage"
  | "inspections:manage"
  | "incidents:view"
  | "finance:view"
  | "dashboards:view"
  | "jobs:view_assigned"
  | "jobs:update_assigned"
  | "installation:perform"
  | "cleaning:create"
  | "inspections:create"
  | "incidents:report"
  | "bookings:view_own_partner"
  | "seats:view_own_partner"
  | "operations:view_own_partner"
  | "finance:view_own_partner";

/**
 * `admin` has no explicit entry — it's `hasPermission`'s short-circuit
 * case (full system access), not a maintained list of every permission
 * that ever gets added.
 */
export const ROLE_PERMISSIONS: Record<Exclude<Role, "admin">, Permission[]> =
  {
    operations_manager: [
      "airports:manage",
      "partners:manage",
      "seats:manage",
      "bookings:manage",
      "technicians:manage",
      "cleaning:manage",
      "inspections:manage",
      "incidents:view",
      "finance:view",
      "dashboards:view",
    ],
    technician: [
      "jobs:view_assigned",
      "jobs:update_assigned",
      "installation:perform",
      "cleaning:create",
      "inspections:create",
      "incidents:report",
    ],
    partner_user: [
      "bookings:view_own_partner",
      "seats:view_own_partner",
      "operations:view_own_partner",
      "finance:view_own_partner",
    ],
  };

/**
 * Pure, no I/O — the single source of truth for "can this role do this".
 * `admin` always passes, per the project's "full system access" reading
 * of the role. Every other area-guard/nav-visibility check in the app
 * must go through this function rather than re-implementing the
 * `role === "admin"` bypass inline.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  if (role === "admin") {
    return true;
  }

  return ROLE_PERMISSIONS[role].includes(permission);
}
