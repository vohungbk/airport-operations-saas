import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { BookingsTableHeader } from "@/features/bookings/components/bookings-table-header";
import type { BookingsQuery } from "@/features/bookings/schemas/bookings-query.schema";

const ROWS = 10;
const COLUMNS = ["Booking", "Partner", "Pickup", "Flight", "Status"] as const;

interface BookingsTableSkeletonProps {
  query: BookingsQuery;
}

/**
 * The bookings table while a filter or a search is read from the server: the header stays as it is
 * and only the body is replaced by placeholder rows.
 */
export function BookingsTableSkeleton({ query }: BookingsTableSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading bookings"
      className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card"
    >
      <Table stacked>
        <BookingsTableHeader query={query} />
        <TableBody className="sm:[&_tr]:border-0">
          {Array.from({ length: ROWS }, (_, row) => (
            <TableRow key={row} className="sm:h-13">
              {COLUMNS.map((label) => (
                <TableCell key={label} data-label={label}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
