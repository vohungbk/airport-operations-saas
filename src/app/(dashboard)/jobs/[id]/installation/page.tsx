import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { INSTALLATION_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageEmpty, PageForbidden } from "@/components/shared/page-state";
import { utcToZonedLocalInput } from "@/features/bookings/lib/booking-time";
import { InstallationForm } from "@/features/installations/components/installation-form";
import { InstallationRecord } from "@/features/installations/components/installation-record";
import { getInstallationContext } from "@/features/installations/lib/get-installation-context";
import { isSeatEligibleForInstallation } from "@/features/installations/lib/seat-eligibility";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";

interface InstallationPageProps {
  params: Promise<{ id: string }>;
}

/**
 * RLS scopes the row: a technician gets `null` (so the forbidden state) for
 * a job that is not theirs. A job that is not an installation job is not
 * found. Once recorded, the installation is shown read-only.
 */
export default async function InstallationPage({
  params,
}: InstallationPageProps) {
  await requireAnyPermission(INSTALLATION_RECORD_PERMISSIONS);

  const { id } = await params;
  const context = await getInstallationContext(id);

  // RLS hides a job that is not the user's the same way as a missing one,
  // so the forbidden state must not say which of the two it is.
  if (!context) {
    return (
      <PageForbidden
        title="You cannot record this installation"
        description="This job was not found or is not assigned to you. Only the assigned technician or an internal role can record it."
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

  const { job, booking, installation } = context;
  const timeZone = booking.airport.timezone;
  const isActive = job.status === "assigned" || job.status === "in_progress";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight break-words text-foreground">
          Installation {booking.booking_number}
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
          {installation ? (
            <InstallationRecord record={installation} timeZone={timeZone} />
          ) : !isActive ? (
            <PageEmpty message="This job is not active, so an installation cannot be recorded." />
          ) : !booking.seat ? (
            <PageEmpty message="This job's booking has no seat assigned yet." />
          ) : !isSeatEligibleForInstallation(booking.seat.status) ? (
            <PageEmpty
              message={`The seat status is ${
                SEAT_STATUS_LABEL[booking.seat.status]
              }, so an installation cannot be recorded.`}
            />
          ) : (
            <InstallationForm
              jobId={job.id}
              seatId={booking.seat.id}
              seatLabel={`${booking.seat.serial_number}${
                booking.seat.category_name
                  ? ` (${booking.seat.category_name})`
                  : ""
              }`}
              timeZone={timeZone}
              defaultInstalledAt={utcToZonedLocalInput(
                new Date().toISOString(),
                timeZone,
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
