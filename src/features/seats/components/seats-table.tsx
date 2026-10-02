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
import { buildSeatsHref } from "@/features/seats/lib/build-seats-href";
import type { SeatListItem } from "@/features/seats/lib/get-seats";
import type {
  SeatsQuery,
  SeatsSortColumn,
} from "@/features/seats/schemas/seats-query.schema";

interface SeatsTableProps {
  seats: SeatListItem[];
  query: SeatsQuery;
}

function SortHeader({
  query,
  column,
  label,
}: {
  query: SeatsQuery;
  column: SeatsSortColumn;
  label: string;
}) {
  const isActive = query.sort === column;
  const href = buildSeatsHref(query, {
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
export function SeatsTable({ seats, query }: SeatsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHeader query={query} column="serial_number" label="Serial" />
          <TableHead>Category</TableHead>
          <TableHead>Airport</TableHead>
          <SortHeader query={query} column="status" label="Status" />
          <TableHead>Public token</TableHead>
          <SortHeader query={query} column="created_at" label="Created" />
          <TableHead className="text-right">Actions</TableHead>
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
            <TableCell className="max-w-40 truncate font-mono text-xs">
              {seat.public_token}
            </TableCell>
            <TableCell>
              {new Date(seat.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/seats/${seat.id}`}
                aria-label={`View seat ${seat.serial_number}`}
                className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
