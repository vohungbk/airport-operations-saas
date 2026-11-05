import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookingEventsTimeline } from "@/features/bookings/components/booking-events-timeline";
import { BookingDetailTabs } from "@/features/bookings/components/booking-detail-tabs";
import { BookingFlightPanel } from "@/features/bookings/components/booking-flight-panel";
import { ChangeBookingStatusDialog } from "@/features/bookings/components/change-booking-status-dialog";
import {
  BOOKING_STATUS_LABEL,
  getAllowedManualTransitions,
  isBookingEditable,
  isPartnerBookingEditable,
} from "@/features/bookings/lib/booking-status";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import type { BookingPageTab } from "@/features/bookings/lib/booking-tabs";
import type { BookingEventsResult } from "@/features/bookings/lib/get-booking-events";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";
import { getInstallationDeadline } from "@/features/flights/lib/flight-panel";

interface BookingDetailProps {
  booking: BookingDetailItem;
  events: BookingEventsResult;
  /** `bookings:manage`: edit and change the status of any booking. */
  canManage: boolean;
  /** `bookings:manage_own_partner`: a partner user may edit a pending booking. */
  canEditOwn: boolean;
  /** `finance:view` or `finance:view_own_partner`: may open how the revenue was calculated. */
  canViewRevenue?: boolean;
  /** The tab that is open when the page loads. */
  defaultTab?: BookingPageTab;
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm break-words text-foreground">
        {children}
      </dd>
    </div>
  );
}

/**
 * The booking in the layout of the design (UI-F06-S03): a heading with the booking, its partner and its
 * status below it, the actions at the right, and tabs for the details, the flight and the timeline. The
 * revenue is a page of its own, so it stays a button in the header, not a tab.
 */
export function BookingDetail({
  booking,
  events,
  canManage,
  canEditOwn,
  canViewRevenue = false,
  defaultTab = "overview",
}: BookingDetailProps) {
  const timeZone = booking.airport?.timezone ?? "UTC";
  const allowedTransitions = getAllowedManualTransitions(booking.status);
  const dateTime = (value: string | null) =>
    value ? formatBookingDateTime(value, timeZone) : "-";
  const deadlineAt = getInstallationDeadline(booking.jobs);
  const hasActions = canManage || canEditOwn || canViewRevenue;
  const canEdit =
    hasActions &&
    (canManage ? isBookingEditable(booking.status) : isPartnerBookingEditable(booking.status));

  return (
    <BookingDetailTabs
      defaultTab={defaultTab}
      subtitle={
        <p className="text-sm break-words text-muted-foreground">
          {booking.booking_number} · {booking.partner?.name ?? "-"} ·{" "}
          {BOOKING_STATUS_LABEL[booking.status]}
        </p>
      }
      actions={
        <>
          <Link
            href={`/bookings/${booking.id}/workflow`}
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 px-4",
            })}
          >
            Workflow
          </Link>
          {canViewRevenue && (
            <Link
              href={`/bookings/${booking.id}/revenue`}
              className={buttonVariants({
                variant: "outline",
                className: "min-h-11 px-4",
              })}
            >
              Revenue
            </Link>
          )}
          {canManage && allowedTransitions.length > 0 && (
            <ChangeBookingStatusDialog
              bookingId={booking.id}
              bookingNumber={booking.booking_number}
              allowedStatuses={allowedTransitions}
            />
          )}
          {canEdit && (
            <Link
              href={`/bookings/${booking.id}/edit`}
              className={buttonVariants({ className: "min-h-11 px-4" })}
            >
              <PlusIcon aria-hidden="true" />
              Edit booking
            </Link>
          )}
        </>
      }
      overview={
        <Card>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Detail label="Partner">{booking.partner?.name ?? "-"}</Detail>
              <Detail label="Airport">
                {booking.airport
                  ? `${booking.airport.code} - ${booking.airport.name}`
                  : "-"}
              </Detail>
              <Detail label="Seat category">
                {booking.category?.name ?? "-"}
              </Detail>
              <Detail label="Pickup">{dateTime(booking.pickup_at)}</Detail>
              <Detail label="Return">{dateTime(booking.return_at)}</Detail>
              <Detail label="Timezone">{timeZone}</Detail>
              <Detail label="Assigned seat">
                {booking.seat?.serial_number ?? "Not assigned"}
              </Detail>
              <Detail label="Daily rate">
                {booking.daily_rate.toFixed(2)}
              </Detail>
              <Detail label="External booking number">
                {booking.external_booking_number ?? "-"}
              </Detail>
              <Detail label="Child age band">
                {booking.child_age_band ?? "-"}
              </Detail>
              <Detail label="Child height">
                {booking.child_height === null ? "-" : booking.child_height}
              </Detail>
              <Detail label="Vehicle">{booking.vehicle ?? "-"}</Detail>
              <Detail label="Vehicle bay">
                {booking.vehicle_bay ?? "-"}
              </Detail>
              <Detail label="Technician">
                {booking.technician?.full_name ?? "-"}
              </Detail>
              <Detail label="Scheduled arrival">
                {dateTime(booking.scheduled_arrival_at)}
              </Detail>
              <Detail label="Incident status">
                {booking.incident_status ?? "-"}
              </Detail>
              <Detail label="Created">{dateTime(booking.created_at)}</Detail>
              <Detail label="Notes">{booking.notes ?? "-"}</Detail>
            </dl>
          </CardContent>
        </Card>
      }
      flight={
        <BookingFlightPanel
          flight={booking.flight}
          timeZone={timeZone}
          city={booking.airport?.city}
          deadlineAt={deadlineAt}
          pickupAt={booking.pickup_at}
          flightNumber={booking.flight_number}
          lookupStatus={booking.flight_lookup_status}
        />
      }
      timeline={
        <Card>
          <CardContent>
            <BookingEventsTimeline
              events={events.items}
              truncated={events.truncated}
              timeZone={timeZone}
            />
          </CardContent>
        </Card>
      }
    />
  );
}
