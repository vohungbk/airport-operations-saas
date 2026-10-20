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
  | "seat_categories:manage"
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
      "seat_categories:manage",
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

/**
 * Any-of variant of `hasPermission` (same `admin` short-circuit): true when
 * the role holds at least one of the listed permissions.
 */
export function hasAnyPermission(
  role: Role,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/** Who may enter `/bookings`: managers, and partner users (view-only). */
export const BOOKINGS_ACCESS_PERMISSIONS = [
  "bookings:manage",
  "bookings:view_own_partner",
] as const satisfies readonly Permission[];

/** Who may enter `/jobs`: managers (all jobs) and technicians (own jobs). */
export const JOBS_ACCESS_PERMISSIONS = [
  "technicians:manage",
  "jobs:view_assigned",
] as const satisfies readonly Permission[];

/**
 * Who may enter `/incidents`: managers (`incidents:view`, all incidents).
 * Technician and partner scope is a later story (FO-F05-S07).
 */
export const INCIDENTS_ACCESS_PERMISSIONS = [
  "incidents:view",
] as const satisfies readonly Permission[];

/**
 * Who may report an incident: technicians (`incidents:report`, only for a job
 * assigned to them, enforced by RLS) and managers (`incidents:view`). The
 * permission matrix is unchanged; this is an any-of set.
 */
export const INCIDENT_REPORT_PERMISSIONS = [
  "incidents:report",
  "incidents:view",
] as const satisfies readonly Permission[];

/**
 * Who may change an incident's status: managers (`incidents:view`). The
 * permission matrix is unchanged; the database function checks the role too.
 */
export const INCIDENT_STATUS_UPDATE_PERMISSIONS = [
  "incidents:view",
] as const satisfies readonly Permission[];

/**
 * Who may change a job's status: technicians (own jobs, scoped by RLS) and
 * managers (any job). Cancelling is further limited to managers in the
 * database function.
 */
export const JOB_STATUS_UPDATE_PERMISSIONS = [
  "jobs:update_assigned",
  "technicians:manage",
] as const satisfies readonly Permission[];

/**
 * Who may open the installation record screen and record an installation:
 * technicians (own jobs, scoped by RLS) and managers. The link on the job
 * detail is offered only to the assigned technician.
 */
export const INSTALLATION_RECORD_PERMISSIONS = [
  "installation:perform",
  "technicians:manage",
] as const satisfies readonly Permission[];

/**
 * Who may open the cleaning record screen and record a cleaning: technicians
 * (own jobs, scoped by RLS) and managers. The link on the job detail is
 * offered only to the assigned technician.
 */
export const CLEANING_RECORD_PERMISSIONS = [
  "cleaning:create",
  "technicians:manage",
] as const satisfies readonly Permission[];

/**
 * Who may open the inspection record screen and record an inspection:
 * technicians (own jobs, scoped by RLS) and managers. The link on the job
 * detail is offered only to the assigned technician.
 */
export const INSPECTION_RECORD_PERMISSIONS = [
  "inspections:create",
  "technicians:manage",
] as const satisfies readonly Permission[];
