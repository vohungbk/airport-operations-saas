/** The sections of a booking (the tab bar of the booking screens). `workflow` is a page of its own. */
export const BOOKING_TABS = ["overview", "workflow", "flight", "timeline"] as const;

export type BookingTab = (typeof BOOKING_TABS)[number];

export const BOOKING_TAB_LABEL: Record<BookingTab, string> = {
  overview: "Overview",
  workflow: "Workflow",
  flight: "Flight",
  timeline: "Timeline",
};

/** The tabs that open inside the booking page itself. Revenue is a page of its own, so it is not one of them. */
export const BOOKING_PAGE_TABS = ["overview", "flight", "timeline", "photos"] as const;

export type BookingPageTab = (typeof BOOKING_PAGE_TABS)[number];

/** The tab named in the address (`?tab=`), or `overview` for anything that is not one of the page's tabs. */
export function resolveBookingPageTab(value: string | string[] | undefined): BookingPageTab {
  const single = Array.isArray(value) ? value[0] : value;
  return BOOKING_PAGE_TABS.find((tab) => tab === single) ?? "overview";
}

export type BookingTabBarValue = BookingPageTab | "revenue";

const TAB_BAR: readonly { value: BookingTabBarValue; label: string }[] = [
  { value: "overview", label: BOOKING_TAB_LABEL.overview },
  { value: "flight", label: BOOKING_TAB_LABEL.flight },
  { value: "revenue", label: "Revenue" },
  { value: "timeline", label: BOOKING_TAB_LABEL.timeline },
  { value: "photos", label: "Photos" },
];

/** The tab bar of the booking page: the Revenue tab is only for a role that may see the revenue (a technician may not). */
export function getBookingTabBar(canViewRevenue: boolean): { value: BookingTabBarValue; label: string }[] {
  return TAB_BAR.filter((tab) => tab.value !== "revenue" || canViewRevenue);
}

/** The address of the revenue page of a booking, the target of the Revenue tab. */
export function buildBookingRevenueHref(bookingId: string): string {
  return `/bookings/${bookingId}/revenue`;
}

/** The heading of the booking page: the design adds the tab to it on the Flight tab (`Booking detail · Flight`). */
export function getBookingPageTitle(tab: BookingPageTab): string {
  return tab === "flight" ? `Booking detail · ${BOOKING_TAB_LABEL.flight}` : "Booking detail";
}

/** The address of a tab of the booking. */
export function buildBookingTabHref(bookingId: string, tab: BookingTab): string {
  if (tab === "overview") return `/bookings/${bookingId}`;
  if (tab === "workflow") return `/bookings/${bookingId}/workflow`;
  return `/bookings/${bookingId}?tab=${tab}`;
}
