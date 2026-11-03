import {
  SortableTableHead,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildBookingsHref } from "@/features/bookings/lib/build-bookings-href";
import type {
  BookingsQuery,
  BookingsSortColumn,
} from "@/features/bookings/schemas/bookings-query.schema";

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

/** The header of the bookings table, shared by the table and its loading skeleton so it never changes while loading. */
export function BookingsTableHeader({ query }: { query: BookingsQuery }) {
  return (
    <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase [&_th_a]:text-[11px] [&_th_a]:font-semibold">
      <TableRow>
        <SortHeader query={query} column="booking_number" label="Booking" />
        <TableHead>Partner</TableHead>
        <SortHeader query={query} column="pickup_at" label="Pickup" />
        <TableHead>Flight</TableHead>
        <SortHeader query={query} column="status" label="Status" />
      </TableRow>
    </TableHeader>
  );
}
