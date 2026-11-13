import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AllocationQueueId, AllocationQueues } from "@/features/dashboard/lib/get-allocation-queues";
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

/** The queues that show a count and one next item (VI-F11-S03), by the queue of the design. */
const ALLOCATION_QUEUE_BY_NAME: Partial<Record<(typeof QUEUES)[number], AllocationQueueId>> = {
  "Seats requiring allocation": "allocation",
  "Installations due": "installations",
  "Cleaning queue": "cleaning",
  "Inspection queue": "inspection",
};

interface OperationalAttentionProps {
  /** Today's arrivals and the upcoming bookings (VI-F11-S02); `null` when they could not be read (a dash). */
  arrivalQueues?: ArrivalQueues | null;
  /** The seats to allocate, installations due and seats in cleaning and inspection (VI-F11-S03); `null` when they could not be read. */
  allocationQueues?: AllocationQueues | null;
}

function QueueLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium hover:underline">
      {children}
    </Link>
  );
}

/** One row of the table; a missing next item or status is a dash. */
function QueueRow({ queue, next, status }: { queue: string; next?: ReactNode; status?: string }) {
  return (
    <TableRow className="sm:h-13">
      <TableCell data-label="Queue">{queue}</TableCell>
      <TableCell data-label="Next item">{next || "—"}</TableCell>
      <TableCell data-label="Status">{status || "—"}</TableCell>
    </TableRow>
  );
}

/** The booking a queue row opens, with its expected arrival (NAV-1). */
function BookingItem({ item }: { item: ArrivalQueueItem }) {
  return (
    <QueueLink href={`/bookings/${item.booking_id}`}>
      {item.booking_number}
      <span className="font-normal text-muted-foreground"> · {item.arrival_label}</span>
    </QueueLink>
  );
}

/**
 * The table of the design (UI-F06-S04): the queue, its next item and its status. Today's arrivals and
 * Upcoming bookings list their bookings (VI-F11-S02), up to five each. Seats requiring allocation,
 * Installations due and the Cleaning and Inspection queues show their count in the name and one next item
 * (VI-F11-S03). A queue with no item or that could not be read, and the queues not built yet (another
 * ticket), show a dash.
 */
export function OperationalAttention({
  arrivalQueues = null,
  allocationQueues = null,
}: OperationalAttentionProps) {
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
                const allocationId = ALLOCATION_QUEUE_BY_NAME[queue];

                if (allocationId && allocationQueues) {
                  const { count, next } = allocationQueues[allocationId];

                  return (
                    <QueueRow
                      key={queue}
                      queue={`${queue} (${count})`}
                      next={next && <QueueLink href={next.href}>{next.label}</QueueLink>}
                      status={next?.status_label}
                    />
                  );
                }

                const items = itemsByQueue[queue];

                if (!items || items.length === 0) {
                  return <QueueRow key={queue} queue={queue} />;
                }

                return items.map((item) => (
                  <QueueRow
                    key={`${queue}-${item.booking_id}`}
                    queue={queue}
                    next={<BookingItem item={item} />}
                    status={item.status_label}
                  />
                ));
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
