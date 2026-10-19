import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { INSPECTION_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { PageEmpty, PageForbidden } from "@/components/shared/page-state";
import { InspectionForm } from "@/features/inspections/components/inspection-form";
import { InspectionRecord } from "@/features/inspections/components/inspection-record";
import { getInspectionContext } from "@/features/inspections/lib/get-inspection-context";
import { canInspectSeat } from "@/features/inspections/lib/seat-eligibility";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";

interface InspectionPageProps {
  params: Promise<{ id: string }>;
}

/**
 * RLS scopes the row: a technician gets `null` (so the forbidden state) for
 * a job that is not theirs. A job that is not an inspection job is not
 * found. Once recorded, the inspection is shown read-only.
 */
export default async function InspectionPage({ params }: InspectionPageProps) {
  await requireAnyPermission(INSPECTION_RECORD_PERMISSIONS);

  const { id } = await params;
  const context = await getInspectionContext(id);

  // RLS hides a job that is not the user's the same way as a missing one,
  // so the forbidden state must not say which of the two it is.
  if (!context) {
    return (
      <PageForbidden
        title="You cannot record this inspection"
        description="This job was not found or is not assigned to you. Only the assigned technician or an internal role can record it."
      >
        <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
          Back to jobs
        </Link>
      </PageForbidden>
    );
  }

  if (context.job.job_type !== "inspection") {
    notFound();
  }

  const { job, booking, inspection } = context;
  const timeZone = booking.airport.timezone;
  const isActive = job.status === "assigned" || job.status === "in_progress";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Inspection {booking.booking_number}
        </h1>
        <Link
          href={`/jobs/${job.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to job
        </Link>
      </div>

      <div className="max-w-lg">
        {inspection ? (
          <InspectionRecord record={inspection} timeZone={timeZone} />
        ) : !isActive ? (
          <PageEmpty message="This job is not active, so an inspection cannot be recorded." />
        ) : !booking.seat ? (
          <PageEmpty message="This job's booking has no seat assigned yet." />
        ) : !canInspectSeat(booking.seat.status) ? (
          <PageEmpty
            message={`The seat status is ${
              SEAT_STATUS_LABEL[booking.seat.status]
            }, so an inspection cannot be recorded.`}
          />
        ) : (
          <InspectionForm
            jobId={job.id}
            seatId={booking.seat.id}
            seatLabel={`${booking.seat.serial_number}${
              booking.seat.category_name ? ` (${booking.seat.category_name})` : ""
            }`}
          />
        )}
      </div>
    </div>
  );
}
