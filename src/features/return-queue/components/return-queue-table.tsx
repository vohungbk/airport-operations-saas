import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatReportedAt } from "@/features/incidents/lib/incident-time";
import { formatMinutes } from "@/features/kpi/lib/additional-kpi-tiles";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import type { ReturnQueueItem } from "@/features/return-queue/lib/return-queue";

interface ReturnQueueTableProps {
  items: ReturnQueueItem[];
}

const HEAD_CLASS =
  "h-auto px-0 py-3 pr-4 text-xs font-semibold leading-4 text-text-muted";
const CELL_CLASS =
  "py-3 pr-4 text-sm leading-5 whitespace-normal break-words text-foreground";

/**
 * Server Component. Columns of the design: seat, booking, current step,
 * returned at, waiting time and status. The seat opens its chain step. Below
 * 640 px the table is a list of cards.
 */
export function ReturnQueueTable({ items }: ReturnQueueTableProps) {
  return (
    <Table stacked>
      <TableHeader className="bg-surface-muted [&_tr]:border-b">
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${HEAD_CLASS} pl-4`}>Seat</TableHead>
          <TableHead className={HEAD_CLASS}>Booking</TableHead>
          <TableHead className={HEAD_CLASS}>Current step</TableHead>
          <TableHead className={HEAD_CLASS}>Returned at</TableHead>
          <TableHead className={HEAD_CLASS}>Waiting time</TableHead>
          <TableHead className={HEAD_CLASS}>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={item.booking_id}
            className="transition-colors hover:bg-primary-subtle"
          >
            <TableCell
              data-label="Seat"
              className={`${CELL_CLASS} pl-4 font-medium`}
            >
              <Link
                href={`/return-queue/${item.booking_id}`}
                className="inline-flex min-h-11 items-center hover:underline"
              >
                {item.seat_serial_number ?? "No seat"}
              </Link>
            </TableCell>
            <TableCell data-label="Booking" className={CELL_CLASS}>
              {item.booking_number}
            </TableCell>
            <TableCell data-label="Current step" className={CELL_CLASS}>
              {item.current_step_label}
            </TableCell>
            <TableCell data-label="Returned at" className={CELL_CLASS}>
              {item.returned_at
                ? formatReportedAt(item.returned_at, item.time_zone)
                : "—"}
            </TableCell>
            <TableCell data-label="Waiting time" className={CELL_CLASS}>
              {item.waiting_minutes === null
                ? "—"
                : formatMinutes(item.waiting_minutes)}
            </TableCell>
            <TableCell data-label="Status" className={CELL_CLASS}>
              {item.seat_status ? (
                <SeatStatusBadge status={item.seat_status} />
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
