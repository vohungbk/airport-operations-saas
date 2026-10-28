"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { CleaningConflictAlert } from "@/features/cleaning/components/cleaning-conflict-alert";
import { isAlreadyRecordedError } from "@/features/cleaning/lib/cleaning-errors";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { useStartCleaning } from "@/features/cleaning/hooks/use-start-cleaning";

interface CleaningStartPanelProps {
  jobId: string;
  seatLabel: string;
}

/**
 * Step one. Starting moves the seat to cleaning, so it is a button with its
 * own result, not a form. Why a start can be refused (a booking holds or uses
 * the seat in the cleaning period) comes back from the database and is shown here.
 */
export function CleaningStartPanel({
  jobId,
  seatLabel,
}: CleaningStartPanelProps) {
  const { start, isPending, result, viewCleaning } = useStartCleaning(jobId);

  return (
    <div className="flex flex-col gap-5">
      {result &&
        !result.success &&
        result.error &&
        (isAlreadyRecordedError(result.error) ? (
          <CleaningConflictAlert
            message="Someone started this cleaning first."
            onViewRecord={viewCleaning}
          />
        ) : (
          <JobActionErrorAlert
            error={result.error}
            fallbackTitle="Could not start the cleaning"
          />
        ))}

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Seat</dt>
          <dd className="mt-1 text-sm text-foreground">{seatLabel}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        Starting marks the seat as being cleaned, so it cannot be booked until
        the cleaning is completed.
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={start}
          disabled={isPending}
          className="min-h-11 px-4"
        >
          {isPending ? "Starting..." : "Start cleaning"}
        </Button>
        <Link
          href={`/jobs/${jobId}`}
          className={buttonVariants({
            variant: "outline",
            className: "min-h-11 px-4",
          })}
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
