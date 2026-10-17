import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { CLEANING_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { PageEmpty, PageForbidden } from "@/components/shared/page-state";
import { utcToZonedLocalInput } from "@/features/bookings/lib/booking-time";
import { CleaningForm } from "@/features/cleaning/components/cleaning-form";
import { CleaningRecord } from "@/features/cleaning/components/cleaning-record";
import { getCleaningContext } from "@/features/cleaning/lib/get-cleaning-context";
import { isSeatEligibleForCleaning } from "@/features/cleaning/lib/seat-eligibility";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";

interface CleaningPageProps {
  params: Promise<{ id: string }>;
}

/**
 * RLS scopes the row: a technician gets `null` (so the forbidden state) for
 * a job that is not theirs. A job that is not a cleaning job is not
 * found. Once recorded, the cleaning is shown read-only.
 */
export default async function CleaningPage({ params }: CleaningPageProps) {
  await requireAnyPermission(CLEANING_RECORD_PERMISSIONS);

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

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cleaning {booking.booking_number}
        </h1>
        <Link
          href={`/jobs/${job.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to job
        </Link>
      </div>

      <div className="max-w-lg">
        {cleaning ? (
          <CleaningRecord record={cleaning} timeZone={timeZone} />
        ) : !isActive ? (
          <PageEmpty message="This job is not active, so a cleaning cannot be recorded." />
        ) : !booking.seat ? (
          <PageEmpty message="This job's booking has no seat assigned yet." />
        ) : !isSeatEligibleForCleaning(booking.seat.status) ? (
          <PageEmpty
            message={`The seat status is ${
              SEAT_STATUS_LABEL[booking.seat.status]
            }, so a cleaning cannot be recorded.`}
          />
        ) : (
          <CleaningForm
            jobId={job.id}
            seatId={booking.seat.id}
            seatLabel={`${booking.seat.serial_number}${
              booking.seat.category_name ? ` (${booking.seat.category_name})` : ""
            }`}
            timeZone={timeZone}
            defaultCleanedAt={utcToZonedLocalInput(
              new Date().toISOString(),
              timeZone,
            )}
          />
        )}
      </div>
    </div>
  );
}
