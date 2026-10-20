import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ChangeIncidentStatusDialog } from "@/features/incidents/components/change-incident-status-dialog";
import { IncidentHistoryTimeline } from "@/features/incidents/components/incident-history-timeline";
import { IncidentSeverityBadge } from "@/features/incidents/components/incident-severity-badge";
import { IncidentStatusBadge } from "@/features/incidents/components/incident-status-badge";
import type { IncidentStatus } from "@/features/incidents/lib/incident-status";
import type {
  IncidentDetailItem,
  IncidentHistoryItem,
} from "@/features/incidents/types";

interface IncidentDetailProps {
  incident: IncidentDetailItem;
  /** `null` hides the history: only managers read it. */
  history: IncidentHistoryItem[] | null;
  historyTruncated: boolean;
  /**
   * False for a partner user: staff names and the link to the job are
   * internal (a partner has no access to the jobs).
   */
  showStaffDetails: boolean;
  /** Transitions the current user may make; empty hides the control. */
  allowedStatuses: IncidentStatus[];
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * The only edit here is the status, through the dialog and the database
 * function behind it. The description is free text: it is rendered as text,
 * never as markup.
 */
export function IncidentDetail({
  incident,
  history,
  historyTruncated,
  showStaffDetails,
  allowedStatuses,
}: IncidentDetailProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Incident: {incident.type}
          </h1>
          <div className="flex items-center gap-2">
            <IncidentSeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {allowedStatuses.length > 0 && (
            <ChangeIncidentStatusDialog
              incidentId={incident.id}
              incidentLabel={incident.type}
              currentStatus={incident.status}
              allowedStatuses={allowedStatuses}
            />
          )}
          <Link
            href="/incidents"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to incidents
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">Description</h2>
        <p className="max-w-prose text-sm whitespace-pre-wrap text-foreground">
          {incident.description}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">Details</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Partner">{incident.partner?.name ?? "-"}</Detail>
          <Detail label="Seat">{incident.seat?.serial_number ?? "-"}</Detail>
          <Detail label="Booking">
            {incident.booking?.booking_number ?? "-"}
          </Detail>
          {showStaffDetails && (
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
          {showStaffDetails && (
            <Detail label="Reported by">
              {incident.reporter?.full_name ?? "-"}
            </Detail>
          )}
          <Detail label="Reported at">{formatDateTime(incident.created_at)}</Detail>
          <Detail label="Updated at">{formatDateTime(incident.updated_at)}</Detail>
          {showStaffDetails && (
            <Detail label="Resolved by">
              {incident.resolver?.full_name ?? "-"}
            </Detail>
          )}
          <Detail label="Resolved at">
            {formatDateTime(incident.resolved_at)}
          </Detail>
        </dl>
      </section>

      {history && (
        <IncidentHistoryTimeline
          history={history}
          truncated={historyTruncated}
        />
      )}
    </div>
  );
}
