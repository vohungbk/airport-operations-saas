import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { BookingEventsTimeline } from "@/features/bookings/components/booking-events-timeline";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingEventsResult } from "@/features/bookings/lib/get-booking-events";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";
import { PreviewSheet } from "@/features/workflow-board/components/preview-sheet";

interface BookingPreviewProps {
  booking: BookingDetailItem;
  events: BookingEventsResult;
  /** The board's address without the booking, where closing the panel goes. */
  closeHref: string;
}

/** The booking selected on the board: the step it is at and how it got there (AC05). */
export function BookingPreview({ booking, events, closeHref }: BookingPreviewProps) {
  const timeZone = booking.airport?.timezone ?? "UTC";
  const subtitle = [booking.partner?.name, booking.flight?.flight_number, booking.airport?.code]
    .filter(Boolean)
    .join(" · ");

  return (
    <PreviewSheet closeHref={closeHref}>
      <div className="flex flex-col gap-1">
        <Link
          href={`/bookings/${booking.id}`}
          className="text-xl font-semibold text-primary hover:underline"
        >
          {booking.booking_number}
        </Link>
        {subtitle && <p className="text-sm text-foreground">{subtitle}</p>}
      </div>

      <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
        <dt className="text-muted-foreground">Current step</dt>
        <dd className="font-semibold text-foreground" data-slot="preview-current-step">
          {BOOKING_STATUS_LABEL[booking.status]}
        </dd>
      </dl>

      <section aria-labelledby="preview-step-history" className="flex flex-col gap-3">
        <h3 id="preview-step-history" className="text-lg font-semibold">
          Step history
        </h3>
        <BookingEventsTimeline
          events={events.items}
          truncated={events.truncated}
          timeZone={timeZone}
        />
      </section>

      <Link
        href={`/bookings/${booking.id}`}
        className={buttonVariants({ className: "mt-auto min-h-11 w-full px-4" })}
      >
        Open booking
      </Link>
    </PreviewSheet>
  );
}
