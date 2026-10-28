import Link from "next/link";

import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { formatBookingFlight } from "@/features/bookings/lib/booking-flight";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import { buildBookingsHref } from "@/features/bookings/lib/build-bookings-href";
import type { BookingListItem } from "@/features/bookings/lib/get-bookings";
import type {
  BookingsQuery,
  BookingsSortColumn,
} from "@/features/bookings/schemas/bookings-query.schema";

interface BookingsTableProps {
  bookings: BookingListItem[];
  query: BookingsQuery;
}

function SortHeader({
  query,
  column,
  label,
}: {
  query: BookingsQuery;
  column: BookingsSortColumn;
  label: string;
}) {
  const isActive = query.sort === column;
  const href = buildBookingsHref(query, {
    sort: column,
    order: isActive && query.order === "asc" ? "desc" : "asc",
  });

  return (
    <SortableTableHead
      href={href}
      label={label}
      direction={isActive ? query.order : null}
      idleIcon
    />
  );
}

/**
 * Server Component — sorting is plain `<Link>` navigation. The whole row opens the booking: the link on the
 * booking number is stretched over the row, so it works with no script and the keyboard reaches it. Below 640 px the table is a list of cards
 * (UI-F06-S03, spec R10); from 640 px up it is the table it was.
 */
export function BookingsTable({ bookings, query }: BookingsTableProps) {
  return (
    <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
      <Table stacked>
        <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase [&_th_a]:text-[11px] [&_th_a]:font-semibold">
          <TableRow>
            <SortHeader query={query} column="booking_number" label="Booking" />
            <TableHead>Partner</TableHead>
            <SortHeader query={query} column="pickup_at" label="Pickup" />
            <TableHead>Flight</TableHead>
            <SortHeader query={query} column="status" label="Status" />
          </TableRow>
        </TableHeader>
        <TableBody className="sm:[&_tr]:border-0">
          {bookings.map((booking) => {
            const timeZone = booking.airport?.timezone ?? "UTC";

            return (
              <TableRow
                key={booking.id}
                className="relative cursor-pointer sm:h-13"
              >
                <TableCell
                  data-label="Booking"
                  className="font-mono text-[13px]"
                >
                  <Link
                    href={`/bookings/${booking.id}`}
                    aria-label={`View booking ${booking.booking_number}`}
                    className="outline-none after:absolute after:inset-0 hover:underline focus-visible:after:rounded-md focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                  >
                    {booking.booking_number}
                  </Link>
                </TableCell>
                <TableCell
                  data-label="Partner"
                  title={booking.partner?.name}
                  className="max-w-48 truncate max-sm:max-w-none"
                >
                  {booking.partner?.name ?? "-"}
                </TableCell>
                <TableCell data-label="Pickup">
                  {formatBookingDateTime(booking.pickup_at, timeZone)}
                </TableCell>
                <TableCell data-label="Flight" className="tabular-nums">
                  {formatBookingFlight(booking.flight)}
                </TableCell>
                <TableCell data-label="Status">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full bg-foreground"
                    />
                    {BOOKING_STATUS_LABEL[booking.status]}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
