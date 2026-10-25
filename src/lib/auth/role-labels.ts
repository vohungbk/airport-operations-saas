import type { Role } from "@/lib/auth/roles";

/**
 * How a role is written for a person. A `Record<Role, ...>` so that a new value of the
 * `user_role` enum is a compile error until it has a label.
 */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  operations_manager: "Operations Manager",
  technician: "Technician",
  partner_user: "Partner User",
};
