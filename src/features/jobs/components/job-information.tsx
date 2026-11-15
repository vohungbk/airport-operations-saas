import Link from "next/link";
import { ScanLine } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ScanBanner } from "@/features/installations/components/scan-banner";
import { TodayFlightCard } from "@/features/jobs/components/today-flight-card";
import { TodayJobCard } from "@/features/jobs/components/today-job-card";
import type { TodayJob } from "@/features/jobs/lib/todays-jobs";

interface JobInformationProps {
  job: TodayJob;
  /** The time the sync age of the flight is counted from. */
  now: Date;
  /** The scan of the seat of the job (NAV-2); null hides the button. */
  scanHref?: string | null;
}

/**
 * The job a technician opened (UI-F07-S02): the same job and flight cards as Today's Jobs, under the
 * heading and the line with the job number, the booking and the time zone of the airport.
 */
export function JobInformation({ job, now, scanHref = null }: JobInformationProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Job information</h1>
        <p className="text-sm break-words text-muted-foreground">
          {[job.job_number, job.booking_number, job.airport?.timezone ?? "UTC"].join(" · ")}
        </p>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <TodayJobCard job={job} />
        <TodayFlightCard job={job} now={now} />
      </div>
      {scanHref && (
        <Link href={scanHref} className={buttonVariants({ className: "min-h-11 px-4 md:self-start" })}>
          <ScanLine aria-hidden="true" data-icon="inline-start" />
          Scan assigned seat
        </Link>
      )}
      {job.job_type === "installation" && (
        <ScanBanner tone="info" title="Readiness gate">
          Seat, checklist, photos and vehicle bay must be verified before installation can be completed.
        </ScanBanner>
      )}
    </div>
  );
}
