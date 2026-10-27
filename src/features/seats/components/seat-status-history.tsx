import { SeatHistoryTimeline } from "@/components/domain/seat-history-timeline";
import {
  SEAT_HISTORY_LIMIT,
  type SeatHistoryItem,
} from "@/features/seats/lib/get-seat-status-history";

interface SeatStatusHistoryProps {
  history: SeatHistoryItem[];
  truncated?: boolean;
}

/** The time of a change as it was shown before the restyle (UI-F06-S02, spec R8): no new time zone. */
const formatChangeTime = (iso: string) => new Date(iso).toLocaleString();

/**
 * Read-only: the log is append-only in the DB, with no edit UI. The changes are shown as the shared
 * `SeatHistoryTimeline` (UI-F06-S02): newest first, each from the old status to the new one, with who
 * made it and why.
 */
export function SeatStatusHistory({
  history,
  truncated = false,
}: SeatStatusHistoryProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="seat-history">
      <h2
        id="seat-history"
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        Status history
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No status changes recorded.
        </p>
      ) : (
        <SeatHistoryTimeline
          formatTime={formatChangeTime}
          history={history.map((entry) => ({
            id: entry.id,
            from_status: entry.from_status,
            to_status: entry.to_status,
            changed_by: entry.changed_by_user?.full_name ?? null,
            created_at: entry.created_at,
            reason: entry.reason,
          }))}
        />
      )}
      {truncated ? (
        <p className="text-sm text-muted-foreground">
          Showing latest {SEAT_HISTORY_LIMIT} changes
        </p>
      ) : null}
    </section>
  );
}
