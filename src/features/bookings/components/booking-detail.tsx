import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageEmpty } from "@/components/shared/page-state";
import { BookingRevenueTab, type BookingRevenueData } from "@/features/bookings/components/booking-revenue-tab";
import { BookingOverview } from "@/features/bookings/components/booking-overview";
import { BookingStatusBadge } from "@/features/bookings/components/booking-status-badge";
import { BookingTimelineTab } from "@/features/bookings/components/booking-timeline-tab";
import { BookingDetailTabs } from "@/features/bookings/components/booking-detail-tabs";
import { BookingFlightPanel } from "@/features/bookings/components/booking-flight-panel";
import { ChangeBookingStatusDialog } from "@/features/bookings/components/change-booking-status-dialog";
import { buildTimelineEntries } from "@/features/bookings/lib/build-timeline-entries";
import { formatStepWithTime } from "@/features/bookings/lib/booking-overview";
import {
  ENDED_BOOKING_STATUS_LIST,
  getAllowedManualTransitions,
  isBookingEditable,
} from "@/features/bookings/lib/booking-status";
import { buildStepHistory, minutesInStep } from "@/features/bookings/lib/booking-step-history";
import type { BookingPageTab } from "@/features/bookings/lib/booking-tabs";
import type { BookingEventsResult } from "@/features/bookings/lib/get-booking-events";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";
import { getInstallationDeadline } from "@/features/flights/lib/flight-panel";
import { stepOf } from "@/lib/workflow/board";
import type { FlightUpdatesResult } from "@/features/flights/lib/get-flight-updates";

interface BookingDetailProps {
  booking: BookingDetailItem;
  events: BookingEventsResult;
  /** `bookings:manage`: edit and change the status of any booking, and see the internal notes. */
  canManage: boolean;
  /** `finance:view` or `finance:view_own_partner`: may open how the revenue was calculated. */
  canViewRevenue?: boolean;
  /** The tab that is open when the page loads. */
  defaultTab?: BookingPageTab;
  /** The revenue of the booking for the Revenue tab; `null` when the role may not see it. */
  revenue?: BookingRevenueData | null;
  /** The history of the booking's flight (VI-F02-T01); `null` when the booking has no linked flight. */
  flightHistory?: FlightUpdatesResult | null;
  /** An admin or an operations manager may enter an arrival by hand (VI-F02-S07, Q4). */
  canEnterArrival?: boolean;
}

/** The badges of the header are 28 px high, taller than the default badge. */
const HEADER_BADGE = "h-7 px-3 text-sm pointer-coarse:h-7";

/**
 * The booking in the layout of the design (UI-F06-T03): a heading with the booking, its partner and its
 * status below it, the badges and Edit booking at the right, and the tabs Overview, Flight, Revenue,
 * Timeline and Photos. Only an admin or an operations manager sees Edit booking; a cancelled booking is read only.
 */
export function BookingDetail({
  booking,
  events,
  canManage,
  canViewRevenue = false,
  revenue = null,
  defaultTab = "overview",
  flightHistory = null,
  canEnterArrival = false,
}: BookingDetailProps) {
  const timeZone = booking.airport?.timezone ?? "UTC";
  const allowedTransitions = getAllowedManualTransitions(booking.status);
  const deadlineAt = getInstallationDeadline(booking.jobs);
  const minutes = minutesInStep(buildStepHistory(events.items), new Date());
  const onPath = stepOf(booking.status) !== null;
  const canEdit = canManage && isBookingEditable(booking.status);

  return (
    <BookingDetailTabs
      defaultTab={defaultTab}
      canViewRevenue={canViewRevenue}
      subtitle={
        <p className="text-sm break-words text-muted-foreground">
          {booking.booking_number} · {booking.partner?.name ?? "-"}
        </p>
      }
      badges={
        <>
          <BookingStatusBadge status={booking.status} className={HEADER_BADGE} />
          {onPath && minutes !== null && (
            <Badge variant="success" className={HEADER_BADGE}>
              <CheckIcon aria-hidden="true" />
              {formatStepWithTime(booking.status, minutes)}
            </Badge>
          )}
        </>
      }
      actions={
        <>
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
              Edit booking
            </Link>
          )}
        </>
      }
      overview={
        <BookingOverview
          booking={booking}
          timeZone={timeZone}
          minutesInStep={minutes}
          deadlineAt={deadlineAt}
          showInternalNotes={canManage}
        />
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
          history={flightHistory}
          manualEntry={
            canEnterArrival && !(ENDED_BOOKING_STATUS_LIST as readonly string[]).includes(booking.status)
              ? { bookingId: booking.id }
              : undefined
          }
        />
      }
      timeline={
        <Card>
          <CardContent>
            <BookingTimelineTab
              entries={buildTimelineEntries({
                events: events.items,
                adjustments: revenue?.adjustments ?? null,
                flightUpdates: flightHistory?.items ?? null,
                timeZone,
              })}
              truncated={events.truncated}
              timeZone={timeZone}
            />
          </CardContent>
        </Card>
      }
      revenue={revenue && <BookingRevenueTab data={revenue} timeZone={timeZone} />}
      photos={<PageEmpty message="Photos are not available yet." />}
    />
  );
}
