import Link from "next/link";

import {
  NONE,
  SectionCard,
} from "@/features/jobs/components/today-parts";
import { JOB_STATUS_LABEL } from "@/features/jobs/lib/job-status";
import type { TodayJob } from "@/features/jobs/lib/todays-jobs";

interface NextJobsCardProps {
  jobs: readonly TodayJob[];
}

/** The jobs after the first, one record each, as the design lists them (UI-F07-S01); a record opens its job (NAV-1). */
export function NextJobsCard({ jobs }: NextJobsCardProps) {
  if (jobs.length === 0) return null;

  return (
    <SectionCard title="Next jobs">
      <ul className="flex flex-col gap-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={`/jobs/${job.id}`}
              className="block min-h-11 rounded-lg border border-border bg-card p-4 text-sm leading-7 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <p className="font-mono font-bold break-words">
                {NONE} · {job.booking_number}
              </p>
              <p className="break-words">
                Partner / location: {NONE} · {job.vehicle_bay ?? NONE}
              </p>
              <p className="break-words">
                Vehicle / seat: {job.vehicle ?? NONE} · {job.seat ?? NONE}
              </p>
              <p>Deadline: {NONE}</p>
              <p>Status: ● {JOB_STATUS_LABEL[job.status]}</p>
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
