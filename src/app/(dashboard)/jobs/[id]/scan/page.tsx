import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  INCIDENT_REPORT_PERMISSIONS,
  INSTALLATION_RECORD_PERMISSIONS,
  hasAnyPermission,
} from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { PageEmpty, PageForbidden } from "@/components/shared/page-state";
import { SeatScanFlow } from "@/features/installations/components/seat-scan-flow";
import { getInstallationContext } from "@/features/installations/lib/get-installation-context";

interface ScanPageProps {
  params: Promise<{ id: string }>;
}

/**
 * UI-F07-S02: the scan of the seat of an installation job. The page checks the permission on the server;
 * RLS scopes the job, so a job that is not the technician's looks the same as a missing one (the forbidden
 * state). A scan only identifies a seat: the action behind it reads and grants nothing (spec R8).
 */
export default async function ScanPage({ params }: ScanPageProps) {
  const user = await requireAnyPermission(INSTALLATION_RECORD_PERMISSIONS);

  const { id } = await params;
  const context = await getInstallationContext(id);

  if (!context) {
    return (
      <PageForbidden
        title="You cannot scan for this job"
        description="This job was not found or is not assigned to you. Only the assigned technician or an internal role can scan its seat."
      >
        <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
          Back to jobs
        </Link>
      </PageForbidden>
    );
  }

  if (context.job.job_type !== "installation") {
    notFound();
  }

  const { job, booking } = context;
  const isActive = job.status === "assigned" || job.status === "in_progress";

  if (!isActive || !booking.seat) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
        <PageEmpty
          message={
            isActive
              ? "This job's booking has no seat assigned yet."
              : "This job is not active, so its seat cannot be scanned."
          }
        />
      </div>
    );
  }

  return (
    <SeatScanFlow
      jobId={job.id}
      bookingNumber={booking.booking_number}
      timeZone={booking.airport.timezone}
      assignedSerial={booking.seat.serial_number}
      reportHref={
        hasAnyPermission(user.role, INCIDENT_REPORT_PERMISSIONS)
          ? `/incidents/new?job_id=${job.id}`
          : null
      }
    />
  );
}
