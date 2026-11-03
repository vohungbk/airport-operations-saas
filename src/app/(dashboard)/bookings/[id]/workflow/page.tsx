import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { BookingStepHistory } from "@/features/bookings/components/booking-step-history";
import { BookingStepSummary } from "@/features/bookings/components/booking-step-summary";
import { BookingTabsNav } from "@/features/bookings/components/booking-tabs-nav";
import { BookingStepper } from "@/features/bookings/components/booking-stepper";
import { buildStepDeadlineView } from "@/features/bookings/lib/booking-deadlines";
import {
  buildStepHistory,
  formatStepDate,
  formatTimeInStep,
  minutesInStep,
} from "@/features/bookings/lib/booking-step-history";
import { getBookingById } from "@/features/bookings/lib/get-booking-by-id";
import { getBookingEvents } from "@/features/bookings/lib/get-booking-events";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { BOOKINGS_ACCESS_PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { WORKFLOW_BOARD_ROUTE } from "@/lib/constants/routes";

interface BookingWorkflowPageProps {
  params: Promise<{ id: string }>;
}

/**
 * CO-F08-S06: the step of a booking, its history and the seat status. Admin, operations manager and
 * a partner user may open it (`BOOKINGS_ACCESS_PERMISSIONS`), checked here before anything is read;
 * RLS then gives a partner user only the bookings and events of its own partner. A booking that is
 * unknown, malformed or hidden by RLS is the same not-found page. Read only. "Back" goes to the
 * Workflow board for a role that may open it, and to the booking for the others.
 */
export default async function BookingWorkflowPage({ params }: BookingWorkflowPageProps) {
  const user = await requireAnyPermission(BOOKINGS_ACCESS_PERMISSIONS);

  const { id } = await params;
  const [booking, events] = await Promise.all([getBookingById(id), getBookingEvents(id)]);

  if (!booking) {
    notFound();
  }

  const timeZone = booking.airport?.timezone ?? "UTC";
  const history = buildStepHistory(events.items);
  const now = new Date();
  const minutes = minutesInStep(history, now);
  const canOpenBoard = hasPermission(user.role, "dashboards:view");
  // Deadlines are an operations measure: a partner user does not see them.
  const deadline = canOpenBoard
    ? buildStepDeadlineView(booking.status, booking.pickup_at, timeZone, now)
    : null;
  const subtitle = [
    booking.partner?.name,
    booking.flight?.flight_number,
    booking.airport?.code,
    formatStepDate(booking.pickup_at, timeZone),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words text-foreground">
            {booking.booking_number}
          </h1>
          <p className="text-sm break-words text-muted-foreground">{subtitle}</p>
        </div>
        <Link
          href={canOpenBoard ? WORKFLOW_BOARD_ROUTE : `/bookings/${booking.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          {canOpenBoard ? "Back to Workflow board" : "Back to booking"}
        </Link>
      </div>

      <BookingTabsNav bookingId={booking.id} active="workflow" />

      <BookingStepper status={booking.status} />

      <div className="flex flex-col gap-6 lg:flex-row">
        <BookingStepSummary
          status={booking.status}
          seatStatus={booking.seat?.status ?? null}
          timeInStep={minutes === null ? null : formatTimeInStep(minutes)}
          deadline={deadline}
        />
        <BookingStepHistory rows={history} timeZone={timeZone} truncated={events.truncated} />
      </div>
    </div>
  );
}
