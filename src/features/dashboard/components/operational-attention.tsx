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
import type { ActiveReturned } from "@/features/dashboard/lib/get-active-returned";
import type { AllocationQueue, AllocationQueueId, AllocationQueues } from "@/features/dashboard/lib/get-allocation-queues";
import type { ArrivalQueueItem, ArrivalQueues } from "@/features/dashboard/lib/get-arrival-queues";
import type { AttentionList } from "@/features/dashboard/lib/attention-list";
import { isQueueUnavailable, UNAVAILABLE_TEXT, type QueueSources } from "@/features/dashboard/lib/failed-queues";
import { OPEN_INCIDENTS_HREF } from "@/features/dashboard/lib/get-open-incidents";
import { OVERDUE_JOBS_HREF } from "@/features/dashboard/lib/get-overdue-jobs";
import { TECHNICIAN_ASSIGNMENTS_HREF } from "@/features/dashboard/lib/get-technician-assignments";

/** The queues of the design. How each one is counted and what comes next in it is another ticket. */
const QUEUES = [
  "Today's arrivals",
  "Upcoming bookings",
  "Seats requiring allocation",
  "Installations due",
  "Active rentals",
  "Returned seats",
  "Cleaning queue",
  "Inspection queue",
  "Damaged or quarantined",
  "Technician assignments",
  "Overdue tasks",
  "Open incidents",
] as const;

/** The queues that show a count and one next item (VI-F11-S03), by the queue of the design. */
const ALLOCATION_QUEUE_BY_NAME: Partial<Record<(typeof QUEUES)[number], AllocationQueueId>> = {
  "Seats requiring allocation": "allocation",
  "Installations due": "installations",
  "Cleaning queue": "cleaning",
  "Inspection queue": "inspection",
};

/** The queues that list their first items, most urgent first, and link to the full list (VI-F11-S08). */
const LISTED_QUEUES = {
  "Technician assignments": { href: TECHNICIAN_ASSIGNMENTS_HREF, empty: "No technician assignments." },
  "Overdue tasks": { href: OVERDUE_JOBS_HREF, empty: "No overdue tasks." },
  "Open incidents": { href: OPEN_INCIDENTS_HREF, empty: "No open incidents." },
} as const;

interface OperationalAttentionProps {
  /** The open jobs with their technician and deadline (VI-F11-S07); `null` when they could not be read. */
  technicianAssignments?: AttentionList | null;
  /** The overdue jobs, longest overdue first (VI-F11-S08); `null` when they could not be read. */
  overdueList?: AttentionList | null;
  /** The open incidents, most severe first (VI-F11-S08); `null` when they could not be read. */
  openIncidents?: AttentionList | null;
  /** The seats damaged or in quarantine (VI-F11-S05); `null` when they could not be read. */
  quarantineQueue?: AllocationQueue | null;
  /** The active rentals and the returned seats (VI-F11-S04); `null` when they could not be read. */
  activeReturned?: ActiveReturned | null;
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
 * (VI-F11-S03); so do Active rentals and Returned seats (VI-F11-S04) and Damaged or quarantined
 * (VI-F11-S05). Technician assignments, Overdue tasks and Open incidents list their first five items, an empty message when there
 * is none, and a link to the full list when there are more (VI-F11-S08). A queue whose source could not be read says Unavailable and the others still load (VI-F11-S13); a queue with no item shows a dash.
 */
export function OperationalAttention({
  arrivalQueues,
  allocationQueues,
  activeReturned,
  quarantineQueue,
  technicianAssignments,
  overdueList,
  openIncidents,
}: OperationalAttentionProps) {
  const sources: QueueSources = { arrivalQueues, allocationQueues, activeReturned, quarantineQueue, technicianAssignments, overdueList, openIncidents };

  const listsByQueue: Partial<Record<keyof typeof LISTED_QUEUES, AttentionList | null>> = {
    "Technician assignments": technicianAssignments,
    "Overdue tasks": overdueList,
    "Open incidents": openIncidents,
  };

  const countedQueues: Partial<Record<(typeof QUEUES)[number], AllocationQueue>> = {
    ...(allocationQueues &&
      Object.fromEntries(
        Object.entries(ALLOCATION_QUEUE_BY_NAME).map(([name, id]) => [name, allocationQueues[id]]),
      )),
    ...(activeReturned && {
      "Active rentals": activeReturned.active,
      "Returned seats": activeReturned.returned,
    }),
    ...(quarantineQueue && { "Damaged or quarantined": quarantineQueue }),
  };

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
                if (isQueueUnavailable(queue, sources)) {
                  return <QueueRow key={queue} queue={queue} next={<span className="text-muted-foreground">{UNAVAILABLE_TEXT}</span>} />;
                }

                const counted = countedQueues[queue];

                if (counted) {
                  const { count, next } = counted;

                  return (
                    <QueueRow
                      key={queue}
                      queue={`${queue} (${count})`}
                      next={next && <QueueLink href={next.href}>{next.label}</QueueLink>}
                      status={next?.status_label}
                    />
                  );
                }

                if (queue in LISTED_QUEUES) {
                  const { href, empty } = LISTED_QUEUES[queue as keyof typeof LISTED_QUEUES];
                  const list = listsByQueue[queue as keyof typeof LISTED_QUEUES];

                  if (!list) return <QueueRow key={queue} queue={queue} />;

                  if (list.count === 0) {
                    return (
                      <QueueRow
                        key={queue}
                        queue={queue}
                        next={<span className="text-muted-foreground">{empty}</span>}
                      />
                    );
                  }

                  return [
                    ...list.items.map((item) => (
                      <QueueRow
                        key={`${queue}-${item.id}`}
                        queue={queue}
                        next={<QueueLink href={item.href}>{item.label}</QueueLink>}
                        status={item.status_label}
                      />
                    )),
                    ...(list.count > list.items.length
                      ? [
                          <QueueRow
                            key={`${queue}-all`}
                            queue={queue}
                            next={<QueueLink href={href}>View all ({list.count})</QueueLink>}
                          />,
                        ]
                      : []),
                  ];
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
