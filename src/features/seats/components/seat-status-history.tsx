import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import {
  SEAT_HISTORY_LIMIT,
  type SeatHistoryItem,
} from "@/features/seats/lib/get-seat-status-history";

interface SeatStatusHistoryProps {
  history: SeatHistoryItem[];
  truncated?: boolean;
}

/** Read-only: the log is append-only in the database, with no edit UI. */
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Changed by</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {new Date(entry.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {entry.from_status ? (
                    <SeatStatusBadge status={entry.from_status} />
                  ) : (
                    <span className="text-muted-foreground">Created</span>
                  )}
                </TableCell>
                <TableCell>
                  <SeatStatusBadge status={entry.to_status} />
                </TableCell>
                <TableCell>{entry.changed_by_user?.full_name ?? "-"}</TableCell>
                <TableCell>{entry.reason ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {truncated ? (
        <p className="text-sm text-muted-foreground">
          Showing latest {SEAT_HISTORY_LIMIT} changes
        </p>
      ) : null}
    </section>
  );
}
