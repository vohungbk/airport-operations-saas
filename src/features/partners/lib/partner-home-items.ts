export interface PartnerHomeItem {
  id: "bookings" | "seats";
  label: string;
  description: string;
  /** `null` while the view is not released: shown as Not available yet. */
  href: string | null;
}

/**
 * The views the partner home leads to (spec R2). Bookings opens the list the
 * partner user can already open, which RLS limits to their own partner. The
 * partner seats view is VI-F03-S04: until it exists there is no link, so the
 * home never points at a page that is not there.
 */
export const PARTNER_HOME_ITEMS: readonly PartnerHomeItem[] = [
  {
    id: "bookings",
    label: "Bookings",
    description: "The bookings of your organization.",
    href: "/bookings",
  },
  {
    id: "seats",
    label: "Seats",
    description: "The status of your seats.",
    href: null,
  },
];
