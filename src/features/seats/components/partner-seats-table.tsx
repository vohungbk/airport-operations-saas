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
    <SortableTableHead
      href={href}
      label={label}
      direction={isActive ? query.order : null}
      idleIcon
    />
  );
}

/**
 * Server Component. Read-only: a row has no link and no action, because a
 * partner user may look at a seat's status but not open or change the seat.
 */
export function PartnerSeatsTable({ seats, query }: PartnerSeatsTableProps) {
  return (
    <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
      <Table stacked>
        <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase [&_th_a]:text-[11px] [&_th_a]:font-semibold">
          <TableRow>
            <SortHeader query={query} column="serial_number" label="Serial" />
            <TableHead>Category</TableHead>
            <TableHead>Airport</TableHead>
            <SortHeader query={query} column="status" label="Status" />
          </TableRow>
        </TableHeader>
        <TableBody className="sm:[&_tr]:border-0">
          {seats.map((seat) => (
            <TableRow key={seat.id} className="sm:h-13">
              <TableCell data-label="Serial" className="font-mono text-[13px]">
                {seat.serial_number}
              </TableCell>
              <TableCell data-label="Category">
                {seat.category?.name ?? "-"}
              </TableCell>
              <TableCell data-label="Airport">
                {seat.airport?.code ?? "-"}
              </TableCell>
              <TableCell data-label="Status">
                <SeatStatusBadge status={seat.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
