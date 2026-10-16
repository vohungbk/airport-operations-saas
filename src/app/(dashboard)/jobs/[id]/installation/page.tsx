import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { INSTALLATION_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { PageEmpty } from "@/components/shared/page-state";
import { utcToZonedLocalInput } from "@/features/bookings/lib/booking-time";
import { InstallationForm } from "@/features/installations/components/installation-form";
import { InstallationRecord } from "@/features/installations/components/installation-record";
import { getInstallationContext } from "@/features/installations/lib/get-installation-context";

interface InstallationPageProps {
  params: Promise<{ id: string }>;
}

/**
 * RLS scopes the row: a technician gets `null` (so `notFound()`) for a job
 * that is not theirs. A job that is not an installation job is not found
 * either. Once recorded, the installation is shown read-only.
 */
export default async function InstallationPage({
  params,
}: InstallationPageProps) {
  await requireAnyPermission(INSTALLATION_RECORD_PERMISSIONS);

  const { id } = await params;
  const context = await getInstallationContext(id);

  if (!context || context.job.job_type !== "installation") {
    notFound();
  }

  const { job, booking, installation } = context;
  const timeZone = booking.airport.timezone;
  const isActive = job.status === "assigned" || job.status === "in_progress";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Installation {booking.booking_number}
        </h1>
        <Link
          href={`/jobs/${job.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to job
        </Link>
      </div>

      <div className="max-w-lg">
        {installation ? (
          <InstallationRecord record={installation} timeZone={timeZone} />
        ) : !isActive ? (
          <PageEmpty message="This job is not active, so an installation cannot be recorded." />
        ) : !booking.seat ? (
          <PageEmpty message="This job's booking has no seat assigned yet." />
        ) : (
          <InstallationForm
            jobId={job.id}
            seatId={booking.seat.id}
            seatLabel={`${booking.seat.serial_number}${
              booking.seat.category_name ? ` (${booking.seat.category_name})` : ""
            }`}
            timeZone={timeZone}
            defaultInstalledAt={utcToZonedLocalInput(
              new Date().toISOString(),
              timeZone,
            )}
          />
        )}
      </div>
    </div>
  );
}
