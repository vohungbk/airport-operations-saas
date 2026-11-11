import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { PageEmpty } from "@/components/shared/page-state";
import { CleaningJobContext } from "@/features/cleaning/components/cleaning-job-context";
import { CleaningPanel } from "@/features/cleaning/components/cleaning-panel";
import type { CleaningPanelView } from "@/features/cleaning/lib/build-cleaning-panel-view";
import type { JobDetailItem } from "@/features/jobs/types";

interface CleaningManagerViewProps {
  job: JobDetailItem;
  /** Null when the panel cannot be shown; `emptyMessage` then says why. */
  view: CleaningPanelView | null;
  emptyMessage: string | null;
  seatId: string | null;
}

/**
 * The cleaning screen of the Admin and Operations Manager: the panel at the
 * left, the job context at the right. Cleaning records are never deleted, and
 * the screen says so under the panel.
 */
export function CleaningManagerView({
  job,
  view,
  emptyMessage,
  seatId,
}: CleaningManagerViewProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl leading-8 font-semibold break-words text-primary-subtle-foreground">
          Cleaning
        </h1>
        {seatId && (
          <Link
            href={`/seats/${seatId}`}
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 rounded-lg bg-surface px-4",
            })}
          >
            View seat
          </Link>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          {view ? <CleaningPanel view={view} /> : <PageEmpty message={emptyMessage ?? ""} />}
          {view?.recordedLine && (
            <p className="text-sm text-text-muted">{view.recordedLine}</p>
          )}
          <p className="text-sm text-text-muted">
            Cleaning history is retained. No records can be deleted.
          </p>
        </div>
        <CleaningJobContext job={job} links={{ booking: true, technician: true }} />
      </div>
    </div>
  );
}
