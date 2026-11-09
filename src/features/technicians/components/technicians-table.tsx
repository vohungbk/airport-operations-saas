import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTechnicianInitials } from "@/features/technicians/lib/get-technician-initials";
import type { TechnicianListRow } from "@/features/technicians/types";

interface TechniciansTableProps {
  technicians: TechnicianListRow[];
}

const HEAD_CLASS =
  "h-auto px-0 py-0 text-[11px] font-normal uppercase leading-4 text-text-muted";
const CELL_CLASS = "px-0 py-4 text-sm leading-5 text-foreground";

/**
 * Server Component. The name cell links to the detail page so a row can be
 * opened from the keyboard.
 */
export function TechniciansTable({ technicians }: TechniciansTableProps) {
  return (
    <Table>
      <TableHeader className="bg-surface-muted [&_tr]:border-b">
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${HEAD_CLASS} w-[300px] pl-6 pt-4 pb-4`}>
            Technician
          </TableHead>
          <TableHead className={`${HEAD_CLASS} w-[200px] pt-4 pb-4`}>
            Airport
          </TableHead>
          <TableHead className={`${HEAD_CLASS} w-[150px] pt-4 pb-4`}>
            Open jobs
          </TableHead>
          <TableHead className={`${HEAD_CLASS} pt-4 pb-4 pr-6`}>
            Jobs done this week
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {technicians.map((technician) => (
          <TableRow
            key={technician.id}
            className="transition-colors hover:bg-primary-subtle"
          >
            <TableCell className={`${CELL_CLASS} pl-6`}>
              <Link
                href={`/technicians/${technician.id}`}
                className="flex items-center gap-3 font-medium"
              >
                <span
                  aria-hidden="true"
                  className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-base font-semibold"
                >
                  {getTechnicianInitials(technician.full_name)}
                </span>
                {technician.full_name}
              </Link>
            </TableCell>
            <TableCell className={CELL_CLASS}>
              {technician.airport_name
                ? `${technician.airport_name} (${technician.airport_code})`
                : "—"}
            </TableCell>
            <TableCell className={CELL_CLASS}>{technician.open_jobs}</TableCell>
            <TableCell className={`${CELL_CLASS} pr-6`}>
              {technician.jobs_done_this_week}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
