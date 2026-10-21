export interface PartnerHomeItem {
  id: "bookings" | "seats";
  label: string;
  description: string;
  /** `null` while a view is not released: shown as Not available yet. */
  href: string | null;
}

/**
 * The views the partner home leads to (spec R2). Bookings opens the list the
 * partner user can already open, which RLS limits to their own partner. Seats
 * opens the read-only partner seats view (VI-F03-S04). A view that is not
 * released gets `href: null` and no link, so the home never points at a page
 * that is not there.
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
    href: "/partner/seats",
  },
];
