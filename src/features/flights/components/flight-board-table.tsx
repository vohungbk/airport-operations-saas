import Link from "next/link";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, ListIcon, TriangleAlertIcon } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  BoardTime,
  FlightBoardRow,
  FlightChange,
  FlightPriority,
} from "@/features/flights/lib/flight-board";
import { cn } from "@/lib/utils";

interface FlightBoardTableProps {
  rows: readonly FlightBoardRow[];
}

const COLUMNS = [
  "Flight",
  "Booking",
  "Scheduled",
  "Estimated",
  "Change",
  "Priority",
  "Installation deadline",
  "Status",
] as const;

interface TimeCellProps {
  value: BoardTime | null;
}

function TimeCell({ value }: TimeCellProps) {
  if (!value) return <span>-</span>;

  return (
    <span className="flex flex-col">
      <span>{value.date}</span>
      <span>{value.time}</span>
    </span>
  );
}

interface ChangeCellProps {
  change: FlightChange;
}

function ChangeCell({ change }: ChangeCellProps) {
  const Icon = change.kind === "early" ? ArrowDownIcon : change.kind === "delayed" ? ArrowUpIcon : ArrowRightIcon;
  const moved = change.kind === "early" || change.kind === "delayed";

  return (
    <span className={cn("inline-flex items-center gap-2 font-medium", moved ? "text-warning-fg" : "text-muted-foreground")}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {change.label}
    </span>
  );
}

interface PriorityCellProps {
  priority: FlightPriority;
}

function PriorityCell({ priority }: PriorityCellProps) {
  const Icon = priority === "high" ? TriangleAlertIcon : ListIcon;

  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {priority === "high" ? "High" : "Normal"}
    </span>
  );
}

/**
 * Server Component. One row for each booking linked to a flight; the whole row opens the booking (the
 * link on the flight number is stretched over the row, so it works with no script and the keyboard
 * reaches it). Below 640 px the table is a list of cards, like the bookings table.
 */
export function FlightBoardTable({ rows }: FlightBoardTableProps) {
  return (
    <div className="min-w-0 sm:overflow-hidden sm:rounded-xl sm:border sm:bg-card">
      <Table stacked>
        <TableHeader className="sm:bg-muted [&_th]:h-10.5 [&_th]:text-xs [&_th]:font-normal [&_th]:text-muted-foreground">
          <TableRow>
            {COLUMNS.map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs sm:[&_tr]:h-16">
          {rows.map((row) => (
            <TableRow key={row.key} className="relative cursor-pointer hover:bg-muted/50 focus-within:bg-muted/50">
              <TableCell data-label="Flight" className="font-medium">
                <span className="flex flex-col items-start gap-1">
                  <Link
                    href={`/bookings/${row.booking_id}`}
                    aria-label={`View booking ${row.booking_number}`}
                    className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {row.flight_number}
                  </Link>
                  {row.stale_label && (
                    <span className="rounded-full bg-warning-bg px-1 py-0.5 text-[10px] leading-3 font-normal text-warning-fg">
                      {row.stale_label}
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell data-label="Booking">{row.booking_number}</TableCell>
              <TableCell data-label="Scheduled">
                <TimeCell value={row.scheduled} />
              </TableCell>
              <TableCell data-label="Estimated">
                <TimeCell value={row.estimated} />
              </TableCell>
              <TableCell data-label="Change">
                <ChangeCell change={row.change} />
              </TableCell>
              <TableCell data-label="Priority">
                <PriorityCell priority={row.priority} />
              </TableCell>
              <TableCell data-label="Installation deadline">
                <TimeCell value={row.deadline} />
              </TableCell>
              <TableCell data-label="Status">
                <StatusBadge domain="flight" value={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
