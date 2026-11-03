import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { BookingsTableHeader } from "@/features/bookings/components/bookings-table-header";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { formatBookingFlight } from "@/features/bookings/lib/booking-flight";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import type { BookingListItem } from "@/features/bookings/lib/get-bookings";
import type { BookingsQuery } from "@/features/bookings/schemas/bookings-query.schema";

interface BookingsTableProps {
  bookings: BookingListItem[];
  query: BookingsQuery;
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
        <BookingsTableHeader query={query} />
        <TableBody className="sm:[&_tr]:border-0">
          {bookings.map((booking) => {
            const timeZone = booking.airport?.timezone ?? "UTC";

            return (
              <TableRow
                key={booking.id}
                className="relative cursor-pointer focus-within:bg-muted/50 sm:h-13"
              >
                <TableCell
                  data-label="Booking"
                  className="font-mono text-[13px]"
                >
                  <Link
                    href={`/bookings/${booking.id}`}
                    aria-label={`View booking ${booking.booking_number}`}
                    className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
