import Link from "next/link";

import { BOOKING_TABS, BOOKING_TAB_LABEL, buildBookingTabHref, type BookingTab } from "@/features/bookings/lib/booking-tabs";
import { cn } from "@/lib/utils";

interface BookingTabsNavProps {
  bookingId: string;
  /** The tab of the page that shows this bar. */
  active: BookingTab;
}

/** The bar under the header of a booking screen: Overview, Workflow, Flight and Timeline, the open one in blue. */
export function BookingTabsNav({ bookingId, active }: BookingTabsNavProps) {
  return (
    <nav aria-label="Booking sections" className="flex flex-wrap gap-x-8 border-b border-border bg-card px-6">
      {BOOKING_TABS.map((tab) => (
        <Link
          key={tab}
          href={buildBookingTabHref(bookingId, tab)}
          aria-current={tab === active ? "page" : undefined}
          className={cn(
            "-mb-px flex min-h-11 items-center border-b-2 border-transparent px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            tab === active && "border-primary font-semibold text-primary hover:text-primary",
          )}
        >
          {BOOKING_TAB_LABEL[tab]}
        </Link>
      ))}
    </nav>
  );
}
