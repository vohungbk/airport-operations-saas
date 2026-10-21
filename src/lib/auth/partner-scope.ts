import type { Role } from "@/lib/auth/roles";
import type { PartnerStatus } from "@/features/partners/types";

export type PartnerAccessIssue = "no_partner" | "partner_inactive";

/**
 * Pure. Why a partner user cannot use the portal, or `null` when they can.
 *
 * - `no_partner`: the profile has no partner (VI-F03-S05, spec E2). RLS gives
 *   such a user no rows, so every screen would be empty.
 * - `partner_inactive`: the partner is not `active` (suspended, inactive or
 *   pending), or it could not be read, which is treated the same (VI-F03-S07,
 *   spec E1). Checked on every request, so it holds while the user is signed
 *   in; the database gives such a user no rows either.
 *
 * The other roles have no partner by design and are never affected.
 */
export function getPartnerAccessIssue(user: {
  role: Role;
  partner_id: string | null;
  partner_status: PartnerStatus | null;
}): PartnerAccessIssue | null {
  if (user.role !== "partner_user") {
    return null;
  }

  if (user.partner_id === null) {
    return "no_partner";
  }

  return user.partner_status === "active" ? null : "partner_inactive";
}
