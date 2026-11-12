import type { ReactNode } from "react";
import Link from "next/link";

import { ChangeIncidentStatusDialog } from "@/features/incidents/components/change-incident-status-dialog";
import { IncidentHistoryTimeline } from "@/features/incidents/components/incident-history-timeline";
import { IncidentSeverityBadge } from "@/features/incidents/components/incident-severity-badge";
import { IncidentStatusBadge } from "@/features/incidents/components/incident-status-badge";
import { formatIncidentSeat } from "@/features/incidents/lib/incident-seat";
import type { IncidentStatus } from "@/features/incidents/lib/incident-status";
import { formatReportedAt } from "@/features/incidents/lib/incident-time";
import type {
  IncidentDetailItem,
  IncidentHistoryItem,
} from "@/features/incidents/types";

interface IncidentDetailProps {
  incident: IncidentDetailItem;
  /** `null` hides the history: only managers read it. */
  history: IncidentHistoryItem[] | null;
  historyTruncated: boolean;
  /** False for a partner user: staff names are internal. */
  showStaffDetails: boolean;
  /**
   * True for a technician only: the link back to the job they reported from.
   * A partner has no access to the jobs; the manager design has no job row.
   */
  showJobLink: boolean;
  /** Transitions the current user may make; empty hides the control. */
  allowedStatuses: IncidentStatus[];
  /** `Admin - Full access`; `null` leaves the line out. */
  accessLabel: string | null;
  /** The zone the times are written in. */
  timeZone: string;
}

const CARD_CLASS =
  "flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
      <dt className="text-sm leading-5 text-text-muted">{label}</dt>
      <dd className="min-w-0 text-sm leading-5 break-words whitespace-pre-wrap text-foreground">
        {children}
      </dd>
    </div>
  );
}

/**
 * The only edit here is the status, through the dialog and the database
 * function behind it. The description is free text: it is rendered as text,
 * never as markup. Photos are read only and wait for photo storage.
 */
export function IncidentDetail({
  incident,
  history,
  historyTruncated,
  showStaffDetails,
  showJobLink,
  allowedStatuses,
  accessLabel,
  timeZone,
}: IncidentDetailProps) {
  const place = [
    incident.booking?.airport?.code,
    formatReportedAt(incident.created_at, timeZone, ", "),
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl leading-8 font-semibold break-words text-primary-subtle-foreground">
            {incident.type}
          </h1>
          {accessLabel && (
            <p className="text-sm leading-5 text-foreground">{accessLabel}</p>
          )}
          <p className="text-sm leading-5 text-foreground">{place}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IncidentSeverityBadge severity={incident.severity} />
          <IncidentStatusBadge status={incident.status} />
        </div>
        {allowedStatuses.length > 0 && (
          <ChangeIncidentStatusDialog
            incidentId={incident.id}
            incidentLabel={incident.type}
            currentStatus={incident.status}
            allowedStatuses={allowedStatuses}
          />
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section aria-labelledby="incident-details" className={CARD_CLASS}>
          <h2
            id="incident-details"
            className="text-base font-semibold text-foreground"
          >
            Incident
          </h2>
          <dl className="flex flex-col gap-3">
            <Detail label="Seat">
              {formatIncidentSeat(incident.seat) ?? "-"}
            </Detail>
            <Detail label="Booking">
              {incident.booking?.booking_number ?? "-"}
            </Detail>
            {showStaffDetails && (
              <Detail label="Reported by">
                {incident.reporter?.full_name ?? "-"}
              </Detail>
            )}
            <Detail label="Reported at">
              {formatReportedAt(incident.created_at, timeZone)}
            </Detail>
            <Detail label="Description">{incident.description}</Detail>
            {showJobLink && (
              <Detail label="Job">
                {incident.technician_job_id ? (
                  <Link
                    href={`/jobs/${incident.technician_job_id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    View job
                  </Link>
                ) : (
                  "-"
                )}
              </Detail>
            )}
          </dl>
        </section>

        {history && (
          <div className="flex min-w-0 flex-col gap-3">
            <div className={CARD_CLASS}>
              <IncidentHistoryTimeline
                history={history}
                truncated={historyTruncated}
                timeZone={timeZone}
              />
            </div>
            <p className="text-sm leading-5 text-text-muted">
              History retained permanently. No delete action.
            </p>
          </div>
        )}
      </div>

      <section aria-labelledby="incident-photos" className="flex flex-col gap-3">
        <h2
          id="incident-photos"
          className="text-base font-semibold text-foreground"
        >
          Photos - read only
        </h2>
        <p className="text-sm text-text-muted">No photos added.</p>
      </section>
    </div>
  );
}
