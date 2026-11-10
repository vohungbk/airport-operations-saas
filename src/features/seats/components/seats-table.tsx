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
import type { SeatListItem } from "@/features/seats/lib/get-seats";

interface SeatsTableProps {
  seats: SeatListItem[];
}

const HEAD_CLASS =
  "h-auto px-0 py-0 text-xs font-normal leading-4 text-text-muted";
const CELL_CLASS = "py-3 pr-4 text-sm leading-5 whitespace-normal break-words text-foreground";

/**
 * Server Component. The serial number links to the detail page so a row
 * can be opened from the keyboard.
 */
export function SeatsTable({ seats }: SeatsTableProps) {
  return (
    <Table stacked className="sm:table-fixed">
      <TableHeader className="bg-surface-muted [&_tr]:border-b">
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${HEAD_CLASS} w-[20%] py-3 pr-4 pl-4`}>
            Serial number
          </TableHead>
          <TableHead className={`${HEAD_CLASS} w-[32%] py-3 pr-4`}>
            Airport
          </TableHead>
          <TableHead className={`${HEAD_CLASS} w-[30%] py-3 pr-4`}>Category</TableHead>
          <TableHead className={`${HEAD_CLASS} w-[18%] py-3 pr-4`}>
            Status
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {seats.map((seat) => (
          <TableRow
            key={seat.id}
            className="transition-colors hover:bg-primary-subtle"
          >
            <TableCell
              data-label="Serial number"
              className={`${CELL_CLASS} pl-4 font-medium`}
            >
              <Link href={`/seats/${seat.id}`}>{seat.serial_number}</Link>
            </TableCell>
            <TableCell data-label="Airport" className={CELL_CLASS}>
              {seat.airport ? `${seat.airport.name} (${seat.airport.code})` : "—"}
            </TableCell>
            <TableCell data-label="Category" className={CELL_CLASS}>
              {seat.category?.name ?? "—"}
            </TableCell>
            <TableCell data-label="Status" className={`${CELL_CLASS}`}>
              <SeatStatusBadge status={seat.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
