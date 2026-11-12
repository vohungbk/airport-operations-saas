import { Timeline } from "@/components/domain/timeline";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  CHAIN_HISTORY_LIMIT,
  toChainHistoryEntries,
  type ChainHistoryRow,
} from "@/features/return-queue/lib/chain-history";

interface ChainHistoryProps {
  rows: ChainHistoryRow[];
  truncated?: boolean;
  formatTime: (iso: string) => string;
  /** The seat page shows the steps of several bookings, so each step names its booking. */
  showBooking?: boolean;
}

/**
 * Read only (FO-F08-S10, R9): the steps are append-only in the DB and there is no edit or delete UI.
 * Newest first, each step with its result, note, photo count, who completed it and when.
 */
export function ChainHistory({ rows, truncated = false, formatTime, showBooking = false }: ChainHistoryProps) {
  const entries = toChainHistoryEntries(rows, showBooking);

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      aria-labelledby="chain-history"
    >
      <h2 id="chain-history" className="text-base leading-snug font-semibold text-foreground">
        Chain history
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No chain steps recorded.</p>
      ) : (
        <Timeline
          formatTime={formatTime}
          events={entries.map((entry) => ({
            id: entry.id,
            actor: entry.actor,
            occurred_at: entry.occurred_at,
            note: entry.note,
            title: (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span>{entry.step_label}</span>
                <StatusBadge domain="result" value={entry.result} />
                <span className="text-xs font-normal text-muted-foreground">
                  {[entry.booking_number, entry.photos_label].filter(Boolean).join(" · ")}
                </span>
              </span>
            ),
          }))}
        />
      )}
      {truncated ? (
        <p className="text-sm text-muted-foreground">Showing latest {CHAIN_HISTORY_LIMIT} steps</p>
      ) : null}
    </section>
  );
}
