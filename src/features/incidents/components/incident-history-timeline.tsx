import { INCIDENT_HISTORY_LIMIT } from "@/features/incidents/lib/get-incident-history";
import { INCIDENT_STATUS_LABEL } from "@/features/incidents/lib/incident-status";
import { formatReportedAt } from "@/features/incidents/lib/incident-time";
import type { IncidentHistoryItem } from "@/features/incidents/types";

interface IncidentHistoryTimelineProps {
  history: IncidentHistoryItem[];
  truncated?: boolean;
  /** The zone the times are written in. */
  timeZone: string;
}

/**
 * Read-only: the log is append-only in the database, with no edit UI. The
 * first entry has no previous status: it reads `Created -> Open`.
 */
export function IncidentHistoryTimeline({
  history,
  truncated = false,
  timeZone,
}: IncidentHistoryTimelineProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="incident-history">
      <h2
        id="incident-history"
        className="text-base font-medium text-foreground"
      >
        Status history
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-text-muted">No changes recorded.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {history.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm leading-5 text-foreground"
            >
              <p>
                {entry.from_status
                  ? INCIDENT_STATUS_LABEL[entry.from_status]
                  : "Created"}
                <span aria-hidden="true"> → </span>
                <span className="sr-only"> to </span>
                {INCIDENT_STATUS_LABEL[entry.to_status]}
              </p>
              <p>{entry.actor_name ?? "Staff"}</p>
              <p>
                <time dateTime={entry.created_at}>
                  {formatReportedAt(entry.created_at, timeZone)}
                </time>
              </p>
              {entry.notes && (
                <p className="break-words whitespace-pre-wrap">{entry.notes}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {truncated && (
        <p className="text-sm text-text-muted">
          Showing latest {INCIDENT_HISTORY_LIMIT} changes
        </p>
      )}
    </section>
  );
}
