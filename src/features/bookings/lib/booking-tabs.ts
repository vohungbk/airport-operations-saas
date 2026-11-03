/** The sections of a booking (the tab bar of the booking screens). `workflow` is a page of its own. */
export const BOOKING_TABS = ["overview", "workflow", "flight", "timeline"] as const;

export type BookingTab = (typeof BOOKING_TABS)[number];

export const BOOKING_TAB_LABEL: Record<BookingTab, string> = {
  overview: "Overview",
  workflow: "Workflow",
  flight: "Flight",
  timeline: "Timeline",
};

/** The tabs that are shown inside the booking page itself, in the order they have there. */
export type BookingPageTab = Exclude<BookingTab, "workflow">;

/** The tab named in the address (`?tab=`), or `overview` for anything that is not one of the page's tabs. */
export function resolveBookingPageTab(value: string | string[] | undefined): BookingPageTab {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "flight" || single === "timeline" ? single : "overview";
}

/** The address of a tab of the booking. */
export function buildBookingTabHref(bookingId: string, tab: BookingTab): string {
  if (tab === "overview") return `/bookings/${bookingId}`;
  if (tab === "workflow") return `/bookings/${bookingId}/workflow`;
  return `/bookings/${bookingId}?tab=${tab}`;
}
