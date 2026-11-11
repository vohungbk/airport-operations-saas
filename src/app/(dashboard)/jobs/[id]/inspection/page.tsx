import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  INSPECTION_RECORD_PERMISSIONS,
  hasPermission,
} from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { PageForbidden } from "@/components/shared/page-state";
import { InspectionManagerView } from "@/features/inspections/components/inspection-manager-view";
import { getInspectionContext } from "@/features/inspections/lib/get-inspection-context";
import { getInspectionHistory } from "@/features/inspections/lib/get-inspection-history";
import { canInspectSeat } from "@/features/inspections/lib/seat-eligibility";
import { getJobById } from "@/features/jobs/lib/get-job-by-id";
import { NOT_ASSIGNED_MESSAGE } from "@/features/jobs/lib/job-work-panel";
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
  const user = await requireAnyPermission(INSPECTION_RECORD_PERMISSIONS);

  const { id } = await params;
  const context = await getInspectionContext(id);

  // RLS hides a job that is not the user's the same way as a missing one,
  // so the forbidden state must not say which of the two it is.
  if (!context) {
    return (
      <PageForbidden
        title={NOT_ASSIGNED_MESSAGE}
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
  const isActive = job.status === "assigned" || job.status === "in_progress";
  const seatLabel = booking.seat
    ? `${booking.seat.serial_number}${
        booking.seat.category_name ? ` (${booking.seat.category_name})` : ""
      }`
    : "";
  const emptyMessage = inspection
    ? null
    : !isActive
      ? "This job is not active, so an inspection cannot be recorded."
      : !booking.seat
        ? "This job's booking has no seat assigned yet."
        : !canInspectSeat(booking.seat.status)
          ? `The seat status is ${
              SEAT_STATUS_LABEL[booking.seat.status]
            }, so an inspection cannot be recorded.`
          : null;

  const detail = await getJobById(id);

  if (!detail) {
    notFound();
  }

  return (
    <InspectionManagerView
      job={detail}
      seat={booking.seat}
      seatLabel={seatLabel}
      record={inspection}
      emptyMessage={emptyMessage}
      history={booking.seat ? await getInspectionHistory(booking.seat.id) : []}
      links={{
        seat: hasPermission(user.role, "seats:manage"),
        technician: hasPermission(user.role, "technicians:manage"),
      }}
    />
  );
}
