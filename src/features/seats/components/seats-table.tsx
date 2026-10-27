import { TextLink } from "@/components/ui/text-link";
import {
  SortableTableHead,
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

  return <SortableTableHead href={href} label={label} direction={isActive ? query.order : null} />;
}

/** Server Component — sorting is plain `<Link>` navigation. */
export function SeatsTable({ seats, query }: SeatsTableProps) {
  return (
    <Table stacked>
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
            <TableCell data-label="Serial" className="font-medium">
              {seat.serial_number}
            </TableCell>
            <TableCell data-label="Category">{seat.category?.name ?? "-"}</TableCell>
            <TableCell data-label="Airport">{seat.airport?.code ?? "-"}</TableCell>
            <TableCell data-label="Status">
              <SeatStatusBadge status={seat.status} />
            </TableCell>
            <TableCell
              data-label="Public token"
              title={seat.public_token}
              className="max-w-40 truncate font-mono text-xs max-sm:max-w-none max-sm:break-all"
            >
              {seat.public_token}
            </TableCell>
            <TableCell data-label="Created">
              {new Date(seat.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell data-label="Actions" className="text-right">
              <TextLink href={`/seats/${seat.id}`} aria-label={`View seat ${seat.serial_number}`}>
                View
              </TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
