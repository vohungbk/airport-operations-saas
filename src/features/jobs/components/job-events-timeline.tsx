import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import { JOB_EVENTS_LIMIT } from "@/features/jobs/lib/get-job-events";
import type { JobEventItem } from "@/features/jobs/types";

interface JobEventsTimelineProps {
  events: JobEventItem[];
  truncated?: boolean;
}

function EventSummary({ event }: { event: JobEventItem }) {
  return (
    <span className="flex flex-col gap-1">
      {event.status_changed && (
        <span className="flex flex-wrap items-center gap-2">
          Status changed
          {event.from_status && <JobStatusBadge status={event.from_status} />}
          <span aria-hidden="true">→</span>
          <JobStatusBadge status={event.to_status} />
        </span>
      )}
      {event.technician_changed && (
        <span>
          Technician changed: {event.from_technician_name ?? "-"} →{" "}
          {event.to_technician_name ?? "-"}
        </span>
      )}
    </span>
  );
}

/** Read-only: the log is append-only in the database, with no edit UI. */
export function JobEventsTimeline({
  events,
  truncated = false,
}: JobEventsTimelineProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="job-events">
      <h2
        id="job-events"
        className="text-lg font-medium text-foreground"
      >
        History
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes recorded.</p>
      ) : (
        <ol className="flex flex-col gap-3 border-l border-border pl-4">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 text-sm">
              <p className="text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleString()} ·{" "}
                {event.actor_name ?? "Staff"}
              </p>
              <EventSummary event={event} />
              {event.notes && (
                <p className="text-muted-foreground">Reason: {event.notes}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {truncated && (
        <p className="text-sm text-muted-foreground">
          Showing latest {JOB_EVENTS_LIMIT} changes
        </p>
      )}
    </section>
  );
}
