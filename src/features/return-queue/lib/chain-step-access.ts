import { getHomeRouteForRole } from "@/lib/auth/role-home";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import type { Role } from "@/lib/auth/roles";
import { RETURN_QUEUE_ROUTE } from "@/lib/constants/routes";

/**
 * FO-F08-S08 (R8): a technician works only on the chain of a booking assigned
 * to them. The database decides; this only shapes the screen. Pure, no I/O.
 */
export function isAssignedWorkOnly(role: Role): boolean {
  return role === "technician";
}

/** `Admin · Full access`, or `Technician · Assigned work`. */
export function chainStepAccessLabel(role: Role): string {
  return `${ROLE_LABELS[role]} · ${isAssignedWorkOnly(role) ? "Assigned work" : "Full access"}`;
}

/**
 * Where Cancel and a saved step lead: the Return queue for internal roles, the
 * technician's own home for a technician (they cannot open the Return queue).
 */
export function chainStepBackHref(role: Role): string {
  return isAssignedWorkOnly(role) ? getHomeRouteForRole(role) : RETURN_QUEUE_ROUTE;
}
