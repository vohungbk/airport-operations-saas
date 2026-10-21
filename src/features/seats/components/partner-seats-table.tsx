import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import { buildPartnerSeatsHref } from "@/features/seats/lib/build-partner-seats-href";
import type { PartnerSeatListItem } from "@/features/seats/lib/get-partner-seats";
import type {
  PartnerSeatsQuery,
  PartnerSeatsSortColumn,
} from "@/features/seats/schemas/partner-seats-query.schema";

interface PartnerSeatsTableProps {
  seats: PartnerSeatListItem[];
  query: PartnerSeatsQuery;
}

function SortHeader({
  query,
  column,
  label,
}: {
  query: PartnerSeatsQuery;
  column: PartnerSeatsSortColumn;
  label: string;
}) {
  const isActive = query.sort === column;
  const href = buildPartnerSeatsHref(query, {
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

/**
 * Server Component. Read-only: a row has no link and no action, because a
 * partner user may look at a seat's status but not open or change the seat.
 */
export function PartnerSeatsTable({ seats, query }: PartnerSeatsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHeader query={query} column="serial_number" label="Serial" />
          <TableHead>Category</TableHead>
          <TableHead>Airport</TableHead>
          <SortHeader query={query} column="status" label="Status" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {seats.map((seat) => (
          <TableRow key={seat.id}>
            <TableCell className="font-medium">{seat.serial_number}</TableCell>
            <TableCell>{seat.category?.name ?? "-"}</TableCell>
            <TableCell>{seat.airport?.code ?? "-"}</TableCell>
            <TableCell>
              <SeatStatusBadge status={seat.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
