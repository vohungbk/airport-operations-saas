import { Timeline } from "@/components/domain/timeline";
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
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        History
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes recorded.</p>
      ) : (
        <Timeline
          formatTime={(iso) => new Date(iso).toLocaleString()}
          events={events.map((event) => ({
            id: event.id,
            actor: event.actor_name ?? "Staff",
            occurred_at: event.created_at,
            note: event.notes ? `Reason: ${event.notes}` : null,
            title: <EventSummary event={event} />,
          }))}
        />
      )}
      {truncated && (
        <p className="text-sm text-muted-foreground">
          Showing latest {JOB_EVENTS_LIMIT} changes
        </p>
      )}
    </section>
  );
}
