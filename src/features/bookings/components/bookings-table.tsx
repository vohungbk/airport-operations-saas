import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingStatusBadge } from "@/features/bookings/components/booking-status-badge";
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
    <TableHead
      aria-sort={
        isActive
          ? query.order === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
    >
      <Link
        href={href}
        className="flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {label}
        {isActive && (
          <span aria-hidden="true">{query.order === "asc" ? "↑" : "↓"}</span>
        )}
      </Link>
    </TableHead>
  );
}

/** Server Component — sorting is plain `<Link>` navigation. */
export function BookingsTable({ bookings, query }: BookingsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHeader query={query} column="booking_number" label="Booking" />
          <TableHead>Partner</TableHead>
          <TableHead>Airport</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Seat</TableHead>
          <SortHeader query={query} column="pickup_at" label="Pickup" />
          <SortHeader query={query} column="return_at" label="Return" />
          <SortHeader query={query} column="status" label="Status" />
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => {
          const timeZone = booking.airport?.timezone ?? "UTC";

          return (
            <TableRow key={booking.id}>
              <TableCell className="font-medium">
                {booking.booking_number}
              </TableCell>
              <TableCell>{booking.partner?.name ?? "-"}</TableCell>
              <TableCell>{booking.airport?.code ?? "-"}</TableCell>
              <TableCell>{booking.category?.name ?? "-"}</TableCell>
              <TableCell>{booking.seat?.serial_number ?? "-"}</TableCell>
              <TableCell>
                {formatBookingDateTime(booking.pickup_at, timeZone)}
              </TableCell>
              <TableCell>
                {formatBookingDateTime(booking.return_at, timeZone)}
              </TableCell>
              <TableCell>
                <BookingStatusBadge status={booking.status} />
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/bookings/${booking.id}`}
                  aria-label={`View booking ${booking.booking_number}`}
                  className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
