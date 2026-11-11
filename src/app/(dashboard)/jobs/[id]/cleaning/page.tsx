import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  CLEANING_RECORD_PERMISSIONS,
  hasPermission,
} from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageEmpty, PageForbidden } from "@/components/shared/page-state";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import { CleaningCompleteForm } from "@/features/cleaning/components/cleaning-complete-form";
import { CleaningStartPanel } from "@/features/cleaning/components/cleaning-start-panel";
import { CleaningRecord } from "@/features/cleaning/components/cleaning-record";
import { CleaningManagerView } from "@/features/cleaning/components/cleaning-manager-view";
import { buildCleaningPanelView } from "@/features/cleaning/lib/build-cleaning-panel-view";
import { getCleaningPanelState } from "@/features/cleaning/lib/cleaning-panel-state";
import { getCleaningContext } from "@/features/cleaning/lib/get-cleaning-context";
import { getSeatBookingConflict } from "@/features/cleaning/lib/get-seat-booking-conflict";
import { getJobById } from "@/features/jobs/lib/get-job-by-id";
import { getSeatLastWork } from "@/features/jobs/lib/get-seat-last-work";
import { canStartCleaningOnSeat } from "@/features/cleaning/lib/seat-eligibility";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";

interface CleaningPageProps {
  params: Promise<{ id: string }>;
}

/**
 * RLS scopes the row: a technician gets `null` (so the forbidden state) for
 * a job that is not theirs. A job that is not a cleaning job is not
 * found. The screen has three steps: not started (Start), in progress
 * (Complete with the result) and completed (read-only).
 */
export default async function CleaningPage({ params }: CleaningPageProps) {
  const user = await requireAnyPermission(CLEANING_RECORD_PERMISSIONS);

  const { id } = await params;
  const context = await getCleaningContext(id);

  // RLS hides a job that is not the user's the same way as a missing one,
  // so the forbidden state must not say which of the two it is.
  if (!context) {
    return (
      <PageForbidden
        title="You cannot record this cleaning"
        description="This job was not found or is not assigned to you. Only the assigned technician or an internal role can record it."
      >
        <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
          Back to jobs
        </Link>
      </PageForbidden>
    );
  }

  if (context.job.job_type !== "cleaning") {
    notFound();
  }

  const { job, booking, cleaning } = context;
  const timeZone = booking.airport.timezone;
  const isActive = job.status === "assigned" || job.status === "in_progress";
  const seatLabel = booking.seat
    ? `${booking.seat.serial_number}${
        booking.seat.category_name ? ` (${booking.seat.category_name})` : ""
      }`
    : "";

  // Admin and Operations Manager have their own panel; the technician screen below is unchanged.
  if (hasPermission(user.role, "technicians:manage")) {
    const detail = await getJobById(id, { withPartner: true });

    if (!detail) {
      notFound();
    }

    const seat = booking.seat;
    const emptyMessage = cleaning
      ? null
      : !isActive
        ? "This job is not active, so a cleaning cannot be started."
        : !seat
          ? "This job's booking has no seat assigned yet."
          : null;
    const conflict =
      !cleaning && isActive && seat
        ? await getSeatBookingConflict(seat.id, booking.id)
        : null;
    const state = getCleaningPanelState({ cleaning, hasBookingConflict: !!conflict });
    const cannotStart =
      !cleaning && !conflict && seat && !canStartCleaningOnSeat(seat.status);
    const lastWork =
      seat && !cleaning && !cannotStart ? await getSeatLastWork(seat.id) : null;

    return (
      <CleaningManagerView
        job={detail}
        seatId={seat?.id ?? null}
        emptyMessage={
          emptyMessage ??
          (cannotStart
            ? `The seat status is ${SEAT_STATUS_LABEL[seat.status]}, so a cleaning cannot be started.`
            : null)
        }
        view={
          seat && !emptyMessage && !cannotStart
            ? buildCleaningPanelView({
                state,
                jobId: job.id,
                seat,
                cleaning,
                conflict,
                lastCleaning: lastWork?.cleaning ?? null,
                timeZone,
                now: new Date(),
              })
            : null
        }
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight break-words text-foreground">
          Cleaning {booking.booking_number}
        </h1>
        <Link
          href={`/jobs/${job.id}`}
          className={buttonVariants({
            variant: "outline",
            className: "min-h-11 px-4",
          })}
        >
          Back to job
        </Link>
      </div>

      <Card className="max-w-lg">
        <CardContent>
          {cleaning?.completed_at ? (
            <CleaningRecord record={cleaning} timeZone={timeZone} />
          ) : cleaning ? (
            <CleaningCompleteForm
              jobId={job.id}
              seatLabel={seatLabel}
              startedLabel={`${formatBookingDateTime(cleaning.started_at, timeZone)} by ${cleaning.recorded_by ?? "staff"}`}
            />
          ) : !isActive ? (
            <PageEmpty message="This job is not active, so a cleaning cannot be started." />
          ) : !booking.seat ? (
            <PageEmpty message="This job's booking has no seat assigned yet." />
          ) : !canStartCleaningOnSeat(booking.seat.status) ? (
            <PageEmpty
              message={`The seat status is ${
                SEAT_STATUS_LABEL[booking.seat.status]
              }, so a cleaning cannot be started.`}
            />
          ) : (
            <CleaningStartPanel jobId={job.id} seatLabel={seatLabel} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
