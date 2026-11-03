import { BoardBookingCard } from "@/features/workflow-board/components/board-booking-card";
import type { BoardColumn } from "@/features/workflow-board/lib/get-workflow-board";
import { isTechnicianActiveStep } from "@/features/workflow-board/lib/technician-board";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import type { Role } from "@/lib/auth/roles";

interface TechnicianBoardColumnsProps {
  columns: BoardColumn[];
  query: WorkflowBoardQuery;
  role: Role;
}

/**
 * The board of a technician on a wide screen (CO-F08-T02, AC03): a column for each step the technician
 * works in, with its count and its cards, and a thin read-only strip for every other step. The strip
 * says its step; its count is read out for a screen reader and shown on a phone, as the design has it.
 */
export function TechnicianBoardColumns({ columns, query, role }: TechnicianBoardColumnsProps) {
  return (
    <div className="flex flex-1 gap-2 overflow-x-auto bg-muted/40 p-6" data-slot="technician-board">
      {columns.map((column) => {
        if (!isTechnicianActiveStep(column.status)) {
          return (
            <div
              key={column.status}
              role="group"
              aria-label={`${column.label}, ${column.total} ${column.total === 1 ? "booking" : "bookings"}, read only`}
              data-slot="board-strip"
              data-status={column.status}
              className="flex w-10 shrink-0 justify-center rounded-lg border border-border bg-muted py-4"
            >
              <span className="text-sm font-semibold whitespace-nowrap text-foreground [writing-mode:vertical-rl]">
                {column.label}
              </span>
            </div>
          );
        }

        const more = column.total - column.cards.length;

        return (
          <section
            key={column.status}
            aria-labelledby={`technician-column-${column.status}`}
            data-slot="board-column"
            data-status={column.status}
            className="flex w-60 shrink-0 flex-col gap-3 rounded-lg bg-muted p-2 sm:w-72"
          >
            <div className="flex items-center justify-between gap-2 px-2 pt-1">
              <h2 id={`technician-column-${column.status}`} className="font-semibold text-foreground">
                {column.label}
              </h2>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-sm font-semibold tabular-nums">
                {column.total}
              </span>
            </div>
            <div className="flex max-h-[calc(100dvh-20rem)] min-h-24 flex-col gap-3 overflow-y-auto">
              {column.cards.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No bookings in this step
                </p>
              )}
              {column.cards.map((card) => (
                <BoardBookingCard key={card.id} booking={card} query={query} selected={false} role={role} previewHref={null} />
              ))}
              {more > 0 && <p className="text-sm font-semibold text-muted-foreground">+{more} more</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
