import { notFound, redirect } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { INSTALLATION_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import { FamilyReadyForm } from "@/features/installations/components/family-ready-form";
import {
  getFamilyReadyState,
  installationBannerLine,
} from "@/features/installations/lib/family-ready";
import { getInstallationContext } from "@/features/installations/lib/get-installation-context";

interface FamilyReadyPageProps {
  params: Promise<{ id: string }>;
}

/**
 * FO-F07-S07: the technician marks the vehicle Family Ready once the installation is recorded. RLS scopes
 * the job to the assigned technician. Without a record there is nothing to confirm, so the user goes back to
 * the installation screen; a vehicle that is already Family Ready (or beyond) goes back to the job.
 */
export default async function FamilyReadyPage({ params }: FamilyReadyPageProps) {
  await requireAnyPermission(INSTALLATION_RECORD_PERMISSIONS);

  const { id } = await params;
  const context = await getInstallationContext(id);

  if (!context || context.job.job_type !== "installation") {
    notFound();
  }

  const { job, booking, installation } = context;

  if (!installation) {
    redirect(`/jobs/${job.id}/installation`);
  }

  if (getFamilyReadyState(booking.status) !== "markable") {
    redirect(`/jobs/${job.id}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <FamilyReadyForm
        jobId={job.id}
        jobNumber={job.job_number}
        bookingNumber={booking.booking_number}
        timeZone={booking.airport.timezone}
        installedLine={installationBannerLine(
          installation.recorded_by,
          installation.completed_at ?? installation.created_at,
          booking.airport.timezone,
        )}
        vehicle={booking.vehicle}
        bay={booking.vehicle_bay}
      />
    </div>
  );
}
