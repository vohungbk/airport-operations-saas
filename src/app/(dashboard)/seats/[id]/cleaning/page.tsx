import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { CLEANING_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { PageForbidden } from "@/components/shared/page-state";
import { getCleaningJobsForSeat } from "@/features/cleaning/lib/get-cleaning-jobs-for-seat";

interface SeatCleaningPageProps {
  params: Promise<{ id: string }>;
}

/**
 * FO-F03-S11: where the QR code of a seat leads a technician or an internal role.
 * It only reads (AC02): the cleaning is started or completed on the cleaning panel
 * of the job, by an explicit action. One open job goes straight to its panel; several
 * are listed; none gives the same state as an unknown seat, so a scan does not tell
 * whether a seat exists (AC04). Access is checked on the server before any query.
 */
export default async function SeatCleaningPage({ params }: SeatCleaningPageProps) {
  await requireAnyPermission(CLEANING_RECORD_PERMISSIONS);

  const { id } = await params;
  const jobs = await getCleaningJobsForSeat(id);

  if (jobs.length === 1) {
    redirect(`/jobs/${jobs[0].id}/cleaning`);
  }

  if (jobs.length === 0) {
    return (
      <PageForbidden
        title="You cannot clean this seat"
        description="There is no open cleaning job for this seat that you can record. Only the assigned technician or an internal role can."
      >
        <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
          Back to jobs
        </Link>
      </PageForbidden>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Choose the cleaning job
      </h1>
      <ul className="flex max-w-lg flex-col gap-2">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={`/jobs/${job.id}/cleaning`}
              className={buttonVariants({ variant: "outline" })}
            >
              Booking {job.booking_number}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
