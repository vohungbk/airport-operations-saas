import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { BookingEventsTimeline } from "@/features/bookings/components/booking-events-timeline";
import { BookingStatusBadge } from "@/features/bookings/components/booking-status-badge";
import { ChangeBookingStatusDialog } from "@/features/bookings/components/change-booking-status-dialog";
import {
  getAllowedManualTransitions,
  isBookingEditable,
} from "@/features/bookings/lib/booking-status";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import type { BookingEventsResult } from "@/features/bookings/lib/get-booking-events";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";

interface BookingDetailProps {
  booking: BookingDetailItem;
  events: BookingEventsResult;
  /** `bookings:manage` — partner users get a view-only page. */
  canManage: boolean;
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function BookingDetail({
  booking,
  events,
  canManage,
}: BookingDetailProps) {
  const timeZone = booking.airport?.timezone ?? "UTC";
  const allowedTransitions = getAllowedManualTransitions(booking.status);
  const dateTime = (value: string | null) =>
    value ? formatBookingDateTime(value, timeZone) : "-";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {booking.booking_number}
          </h1>
          <div>
            <BookingStatusBadge status={booking.status} />
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {isBookingEditable(booking.status) && (
              <Link
                href={`/bookings/${booking.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            )}
            {allowedTransitions.length > 0 && (
              <ChangeBookingStatusDialog
                bookingId={booking.id}
                bookingNumber={booking.booking_number}
                allowedStatuses={allowedTransitions}
              />
            )}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
        <Detail label="Partner">{booking.partner?.name ?? "-"}</Detail>
        <Detail label="Airport">
          {booking.airport
            ? `${booking.airport.code} - ${booking.airport.name}`
            : "-"}
        </Detail>
        <Detail label="Seat category">{booking.category?.name ?? "-"}</Detail>
        <Detail label="Pickup">{dateTime(booking.pickup_at)}</Detail>
        <Detail label="Return">{dateTime(booking.return_at)}</Detail>
        <Detail label="Timezone">{timeZone}</Detail>
        <Detail label="Assigned seat">
          {booking.seat?.serial_number ?? "Not assigned"}
        </Detail>
        <Detail label="Daily rate">{booking.daily_rate.toFixed(2)}</Detail>
        <Detail label="External booking number">
          {booking.external_booking_number ?? "-"}
        </Detail>
        <Detail label="Child age band">{booking.child_age_band ?? "-"}</Detail>
        <Detail label="Child height">
          {booking.child_height === null ? "-" : booking.child_height}
        </Detail>
        <Detail label="Vehicle">{booking.vehicle ?? "-"}</Detail>
        <Detail label="Vehicle bay">{booking.vehicle_bay ?? "-"}</Detail>
        <Detail label="Technician">{booking.technician?.full_name ?? "-"}</Detail>
        <Detail label="Scheduled arrival">
          {dateTime(booking.scheduled_arrival_at)}
        </Detail>
        <Detail label="Incident status">{booking.incident_status ?? "-"}</Detail>
        <Detail label="Created">{dateTime(booking.created_at)}</Detail>
        <Detail label="Notes">{booking.notes ?? "-"}</Detail>
      </dl>

      <BookingEventsTimeline
        events={events.items}
        truncated={events.truncated}
        timeZone={timeZone}
      />
    </div>
  );
}
