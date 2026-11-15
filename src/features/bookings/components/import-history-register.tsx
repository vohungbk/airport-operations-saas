import { ChevronRight } from "lucide-react";

import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImportResultBadge } from "@/features/bookings/components/import-result-badge";
import {
  IMPORT_HISTORY_PAGE_SIZE,
  buildImportHistoryHref,
  getImportResult,
  type ImportHistoryFilters,
} from "@/features/bookings/lib/booking-import-history";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import type { BookingImportsResult } from "@/features/bookings/lib/get-booking-imports";
import { cn } from "@/lib/utils";

interface ImportHistoryRegisterProps {
  result: BookingImportsResult;
  filters: ImportHistoryFilters;
}

const HEAD_CLASS = "h-13 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase";

/** CO-F07-S07 (R4): the register of earlier imports: file, partner, time, actor, rows created and rejected, result. */
export function ImportHistoryRegister({ result, filters }: ImportHistoryRegisterProps) {
  const { items, total, page, timezone } = result;
  const totalPages = Math.max(1, Math.ceil(total / IMPORT_HISTORY_PAGE_SIZE));
  const first = (page - 1) * IMPORT_HISTORY_PAGE_SIZE + 1;
  const last = first + items.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0 overflow-x-auto rounded-lg bg-muted">
        <Table stacked>
          <TableHeader className="[&_tr]:border-0">
            <TableRow>
              <TableHead className={HEAD_CLASS}>File name</TableHead>
              <TableHead className={HEAD_CLASS}>Partner</TableHead>
              <TableHead className={HEAD_CLASS}>Imported at ↓</TableHead>
              <TableHead className={HEAD_CLASS}>Imported by</TableHead>
              <TableHead className={cn(HEAD_CLASS, "text-right")}>Rows created</TableHead>
              <TableHead className={cn(HEAD_CLASS, "text-right")}>Rows rejected</TableHead>
              <TableHead className={HEAD_CLASS}>Result</TableHead>
              <TableHead className="w-8">
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-0">
            {items.map((item) => (
              <TableRow key={item.id} className="sm:h-16">
                <TableCell data-label="File name" className="max-w-56 truncate font-medium" title={item.file_name}>
                  {item.file_name}
                </TableCell>
                <TableCell data-label="Partner">{item.partner_name ?? "-"}</TableCell>
                <TableCell data-label="Imported at" className="tabular-nums">
                  {formatBookingDateTime(item.created_at, timezone)}
                </TableCell>
                <TableCell data-label="Imported by">{item.actor_name ?? "-"}</TableCell>
                <TableCell data-label="Rows created" className="text-right tabular-nums">
                  {item.created_rows}
                </TableCell>
                <TableCell
                  data-label="Rows rejected"
                  className={cn("text-right tabular-nums", item.rejected_rows > 0 && "text-danger-fg")}
                >
                  {item.rejected_rows}
                </TableCell>
                <TableCell data-label="Result">
                  <ImportResultBadge result={getImportResult(item.created_rows, item.rejected_rows)} />
                </TableCell>
                <TableCell aria-hidden="true" className="text-muted-foreground max-sm:hidden">
                  <ChevronRight className="size-3.5" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {first}–{last} of {total} imports
        </p>
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(target) => buildImportHistoryHref(filters, { page: target })}
          className="justify-end"
        />
      </div>
    </div>
  );
}
