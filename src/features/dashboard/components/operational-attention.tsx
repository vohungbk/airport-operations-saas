import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ArrivalQueueItem, ArrivalQueues } from "@/features/dashboard/lib/get-arrival-queues";

/** The queues of the design. How each one is counted and what comes next in it is another ticket. */
const QUEUES = [
  "Today's arrivals",
  "Upcoming bookings",
  "Seats requiring allocation",
  "Installations due",
  "Cleaning queue",
  "Inspection queue",
  "Damaged or quarantined",
  "Technician assignments",
  "Overdue tasks",
] as const;

interface OperationalAttentionProps {
  /** Today's arrivals and the upcoming bookings (VI-F11-S02); `null` when they could not be read (a dash). */
  arrivalQueues?: ArrivalQueues | null;
}

/** The booking a queue row opens, with its expected arrival (NAV-1). */
function BookingItem({ item }: { item: ArrivalQueueItem }) {
  return (
    <Link href={`/bookings/${item.booking_id}`} className="font-medium hover:underline">
      {item.booking_number}
      <span className="font-normal text-muted-foreground"> · {item.arrival_label}</span>
    </Link>
  );
}

/**
 * The table of the design (UI-F06-S04): the queue, its next item and its status. Today's arrivals and
 * Upcoming bookings list their bookings (VI-F11-S02), up to five each; a queue with no booking or that
 * could not be read, and the queues not built yet (another ticket), show a dash.
 */
export function OperationalAttention({ arrivalQueues = null }: OperationalAttentionProps) {
  const itemsByQueue: Partial<Record<(typeof QUEUES)[number], readonly ArrivalQueueItem[]>> = {
    "Today's arrivals": arrivalQueues?.arrivals_today,
    "Upcoming bookings": arrivalQueues?.upcoming_bookings,
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Operational attention
        </h3>
        <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
          <Table stacked>
            <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase">
              <TableRow>
                <TableHead>Queue</TableHead>
                <TableHead>Next item</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="sm:[&_tr]:border-0">
              {QUEUES.flatMap((queue) => {
                const items = itemsByQueue[queue];

                if (!items || items.length === 0) {
                  return (
                    <TableRow key={queue} className="sm:h-13">
                      <TableCell data-label="Queue">{queue}</TableCell>
                      <TableCell data-label="Next item">—</TableCell>
                      <TableCell data-label="Status">—</TableCell>
                    </TableRow>
                  );
                }

                return items.map((item) => (
                  <TableRow key={`${queue}-${item.booking_id}`} className="sm:h-13">
                    <TableCell data-label="Queue">{queue}</TableCell>
                    <TableCell data-label="Next item">
                      <BookingItem item={item} />
                    </TableCell>
                    <TableCell data-label="Status">{item.status_label}</TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
