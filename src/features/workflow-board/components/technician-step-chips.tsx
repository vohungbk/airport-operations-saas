import Link from "next/link";

import type { BoardColumn } from "@/features/workflow-board/lib/get-workflow-board";
import { buildTechnicianBoardHref, isTechnicianActiveStep } from "@/features/workflow-board/lib/technician-board";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import type { BookingStatus } from "@/features/bookings/types";
import { cn } from "@/lib/utils";

interface TechnicianStepChipsProps {
  columns: BoardColumn[];
  query: WorkflowBoardQuery;
  selected: BookingStatus;
}

const CHIP_CLASS = "inline-flex min-h-11 shrink-0 items-center rounded-lg border px-4 text-sm font-semibold whitespace-nowrap";

/**
 * The steps of the board on a phone (CO-F08-T02, AC11): one chip for each step with its count, in a row
 * that scrolls. The steps the technician works in are links, the selected one is filled; the others are
 * read-only chips that show their count.
 */
export function TechnicianStepChips({ columns, query, selected }: TechnicianStepChipsProps) {
  return (
    <ul id="technician-steps" aria-label="Workflow steps" className="flex gap-2 overflow-x-auto pb-1">
      {columns.map((column) => {
        const text = `${column.label} · ${column.total}`;

        return (
          <li key={column.status} className="shrink-0">
            {isTechnicianActiveStep(column.status) ? (
              <Link
                href={buildTechnicianBoardHref(query, column.status)}
                aria-current={column.status === selected ? "true" : undefined}
                className={cn(
                  CHIP_CLASS,
                  column.status === selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground",
                )}
              >
                {text}
              </Link>
            ) : (
              <span aria-disabled="true" className={cn(CHIP_CLASS, "border-border bg-muted text-foreground")}>
                {text}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
