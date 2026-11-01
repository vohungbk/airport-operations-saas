import type { Role } from "@/lib/auth/roles";
import {
  DASHBOARD_ROUTE,
  PARTNER_HOME_ROUTE,
  TECHNICIAN_HOME_ROUTE,
} from "@/lib/constants/routes";

/**
 * The page a signed-in user starts from, by role. Admin and operations manager
 * start on the Command Centre; the technician and the partner user have an area
 * of their own. Used by the root page `/`, so the address of the site opens the
 * right home for each person.
 *
 * Pure, no I/O. `Record<Role, string>` makes a new role a compile error until it
 * gets a home.
 */
const ROLE_HOME_ROUTES: Record<Role, string> = {
  admin: DASHBOARD_ROUTE,
  operations_manager: DASHBOARD_ROUTE,
  technician: TECHNICIAN_HOME_ROUTE,
  partner_user: PARTNER_HOME_ROUTE,
};

export function getHomeRouteForRole(role: Role): string {
  return ROLE_HOME_ROUTES[role];
}
