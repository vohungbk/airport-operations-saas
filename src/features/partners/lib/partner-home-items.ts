import { hasPermission, type Permission } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";

export interface PartnerHomeItem {
  id: "bookings" | "seats" | "finance";
  label: string;
  description: string;
  /** What a user must hold to be offered the view. */
  permission: Permission;
  /** `null` while a view is not released: shown as Not available yet. */
  href: string | null;
}

/**
 * Whether the finance of a partner is released. It is since VI-F04-S14, which adds the
 * `/partner/finance` screen (the route test fails if a link points at a page that is not there).
 */
export const PARTNER_FINANCE_RELEASED = true;

/** The finance view, once VI-F04 adds it. */
export const PARTNER_FINANCE_HREF = "/partner/finance";

interface Released {
  finance: boolean;
}

/**
 * Pure. The views the partner home leads to (spec R2), in the order shown.
 * Bookings opens the list a partner user can already open, which RLS limits to
 * their own partner. Seats opens the read-only partner seats view
 * (VI-F03-S04). Finance (VI-F03-S06) is shown as not available yet until it is
 * released. A view that is not released gets `href: null` and no link, so the
 * home never points at a page that is not there.
 */
export function buildPartnerHomeItems(released: Released): PartnerHomeItem[] {
  return [
    {
      id: "bookings",
      label: "Bookings",
      description: "The bookings of your organization.",
      permission: "bookings:view_own_partner",
      href: "/bookings",
    },
    {
      id: "seats",
      label: "Seats",
      description: "The status of your seats.",
      permission: "seats:view_own_partner",
      href: "/partner/seats",
    },
    {
      id: "finance",
      label: "Finance",
      description: "Your settlements and invoices.",
      permission: "finance:view_own_partner",
      href: released.finance ? PARTNER_FINANCE_HREF : null,
    },
  ];
}

export const PARTNER_HOME_ITEMS: readonly PartnerHomeItem[] =
  buildPartnerHomeItems({ finance: PARTNER_FINANCE_RELEASED });

/** The views offered to a role: each one needs its own permission. */
export function getPartnerHomeItems(
  role: Role,
  items: readonly PartnerHomeItem[] = PARTNER_HOME_ITEMS,
): PartnerHomeItem[] {
  return items.filter((item) => hasPermission(role, item.permission));
}
