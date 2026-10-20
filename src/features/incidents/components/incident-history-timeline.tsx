import { IncidentStatusBadge } from "@/features/incidents/components/incident-status-badge";
import { INCIDENT_HISTORY_LIMIT } from "@/features/incidents/lib/get-incident-history";
import type { IncidentHistoryItem } from "@/features/incidents/types";

interface IncidentHistoryTimelineProps {
  history: IncidentHistoryItem[];
  truncated?: boolean;
}

/** Read-only: the log is append-only in the database, with no edit UI. */
export function IncidentHistoryTimeline({
  history,
  truncated = false,
}: IncidentHistoryTimelineProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="incident-history">
      <h2
        id="incident-history"
        className="text-lg font-medium text-foreground"
      >
        History
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes recorded.</p>
      ) : (
        <ol className="flex flex-col gap-3 border-l border-border pl-4">
          {history.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 text-sm">
              <p className="text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleString()} ·{" "}
                {entry.actor_name ?? "Staff"}
              </p>
              <span className="flex flex-wrap items-center gap-2">
                Status changed
                {entry.from_status && (
                  <IncidentStatusBadge status={entry.from_status} />
                )}
                <span aria-hidden="true">→</span>
                <IncidentStatusBadge status={entry.to_status} />
              </span>
              {entry.notes && (
                <p className="text-muted-foreground">Note: {entry.notes}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {truncated && (
        <p className="text-sm text-muted-foreground">
          Showing latest {INCIDENT_HISTORY_LIMIT} changes
        </p>
      )}
    </section>
  );
}
