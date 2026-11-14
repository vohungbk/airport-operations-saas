import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { PageEmpty } from "@/components/shared/page-state";
import { NameLink } from "@/features/jobs/components/job-detail";
import { InspectionHistory } from "@/features/inspections/components/inspection-history";
import { InspectionJobContext } from "@/features/inspections/components/inspection-job-context";
import { InspectionPanel } from "@/features/inspections/components/inspection-panel";
import { InspectionRecord } from "@/features/inspections/components/inspection-record";
import type { InspectionRecord as InspectionRecordItem } from "@/features/inspections/lib/get-inspection-context";
import type { InspectionHistoryItem } from "@/features/inspections/lib/get-inspection-history";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import type { SeatStatus } from "@/features/seats/types";
import type { JobDetailItem } from "@/features/jobs/types";

interface InspectionManagerViewProps {
  job: JobDetailItem;
  seat: { id: string; serial_number: string; status: SeatStatus } | null;
  seatLabel: string;
  /** The inspection already recorded for this job: shown read only. */
  record: InspectionRecordItem | null;
  /** Why the form cannot be shown, or null when it can. */
  emptyMessage: string | null;
  history: InspectionHistoryItem[];
  links: { seat: boolean; technician: boolean };
}

/**
 * The inspection screen, the same for every role that may record an inspection: the Job, Seat and
 * Technician cards at the left, the Inspection record at the right and the
 * history under it. Inspection records are never deleted.
 */
export function InspectionManagerView({
  job,
  seat,
  seatLabel,
  record,
  emptyMessage,
  history,
  links,
}: InspectionManagerViewProps) {
  const timeZone = job.booking?.airport?.timezone ?? "UTC";
  const airport = job.booking?.airport;

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl leading-8 font-semibold break-words text-primary-subtle-foreground">
          Inspection record
        </h1>
        <p className="text-sm text-text-muted">
          {[job.technician?.full_name, airport && `${airport.name} (${airport.code})`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <InspectionJobContext job={job} links={links} />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col items-start gap-3">
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/jobs/${job.id}`}
                className={buttonVariants({
                  variant: "outline",
                  className: "min-h-11 rounded-lg bg-surface px-4",
                })}
              >
                Back to job
              </Link>
              <Link
                href={`/jobs/${job.id}/photos`}
                className={buttonVariants({
                  variant: "outline",
                  className: "min-h-11 rounded-lg bg-surface px-4",
                })}
              >
                <ImageIcon data-icon="inline-start" aria-hidden="true" />
                Open photos
              </Link>
            </div>
            {seat && (
              <>
                <NameLink href={links.seat ? `/seats/${seat.id}` : null}>
                  {seat.serial_number}
                </NameLink>
                <SeatStatusBadge status={seat.status} />
              </>
            )}
          </div>

          {record ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <InspectionRecord record={record} timeZone={timeZone} />
            </div>
          ) : emptyMessage || !seat ? (
            <PageEmpty message={emptyMessage ?? ""} />
          ) : (
            <InspectionPanel jobId={job.id} seatId={seat.id} seatLabel={seatLabel} />
          )}

          <InspectionHistory items={history} timeZone={timeZone} />
          <p className="text-sm text-text-muted">
            Inspection history is retained. No records can be deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
