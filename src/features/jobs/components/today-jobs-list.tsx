import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { PageEmpty } from "@/components/shared/page-state";
import { buttonVariants } from "@/components/ui/button";
import { NextJobsCard } from "@/features/jobs/components/next-jobs-card";
import { TodayFlightCard } from "@/features/jobs/components/today-flight-card";
import { TodayJobCard } from "@/features/jobs/components/today-job-card";
import { NONE } from "@/features/jobs/components/today-parts";
import { formatNextJob } from "@/features/jobs/lib/job-time";
import type { TodaysJobs } from "@/features/jobs/lib/todays-jobs";

interface TodayJobsListProps {
  today: TodaysJobs;
  /** The time the sync age is counted from. */
  now: Date;
}

/**
 * Today's Jobs as the design draws it (UI-F07-S01): the priority banner for an early flight, the first job
 * with its flight and the button that opens its installation, and the next jobs. With no job it is the
 * empty state with the time of the next job when there is one (spec E3).
 */
export function TodayJobsList({ today, now }: TodayJobsListProps) {
  const [first, ...rest] = today.jobs;

  if (!first) {
    return (
      <PageEmpty
        message={
          today.next_pickup_at
            ? `No jobs today. Next job: ${formatNextJob(today.next_pickup_at)}.`
            : "No jobs today."
        }
      />
    );
  }

  const early = today.jobs.find((job) => job.flight?.timing === "early");

  return (
    <>
      {early?.flight && (
        <div
          data-slot="priority-banner"
          className="flex min-w-0 items-start gap-3 rounded-lg bg-info-bg p-4 text-sm text-info-fg"
        >
          <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold break-words">
              Priority · {early.flight.flight_number} arriving{" "}
              {Math.abs(early.flight.offset_minutes ?? 0)} minutes early
            </p>
            <p className="break-words">
              Complete {NONE} before {NONE}.
            </p>
          </div>
        </div>
      )}
      <TodayJobCard job={first} />
      <TodayFlightCard job={first} now={now} />
      <Link
        href={`/jobs/${first.id}/installation`}
        className={buttonVariants({ className: "min-h-11 px-4" })}
      >
        Open installation job
      </Link>
      <NextJobsCard jobs={rest} />
    </>
  );
}
