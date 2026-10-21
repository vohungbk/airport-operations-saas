import type { Role } from "@/lib/auth/roles";

/**
 * Pure. A partner user whose profile has no partner. RLS gives such a user no
 * rows, so every portal screen would be empty or show zeros; the portal treats
 * it as no access instead (VI-F03-S05, spec E2). The other roles have no
 * partner by design and are never affected.
 */
export function isUnlinkedPartnerUser(user: {
  role: Role;
  partner_id: string | null;
}): boolean {
  return user.role === "partner_user" && user.partner_id === null;
}
