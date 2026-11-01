import Link from "next/link";

import { BoardBookingCard } from "@/features/workflow-board/components/board-booking-card";
import type { BoardColumn } from "@/features/workflow-board/lib/get-workflow-board";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";

interface WorkflowBoardColumnsProps {
  columns: BoardColumn[];
  query: WorkflowBoardQuery;
}

/** The address of the list of bookings in one step, with the filters the list also has (airport, search, day). */
function moreHref(column: BoardColumn, query: WorkflowBoardQuery): string {
  const params = new URLSearchParams({ status: column.status });

  if (query.airport_id) params.set("airport_id", query.airport_id);
  if (query.q) params.set("q", query.q);
  if (query.date) {
    params.set("date_from", query.date);
    params.set("date_to", query.date);
  }

  return `/bookings?${params.toString()}`;
}

/** One column per step of the booking path, each with its count and its cards. */
export function WorkflowBoardColumns({ columns, query }: WorkflowBoardColumnsProps) {
  return (
    <div className="flex flex-1 gap-6 overflow-x-auto bg-muted/40 p-6" data-slot="workflow-board">
      {columns.map((column) => {
        const more = column.total - column.cards.length;

        return (
          <section
            key={column.status}
            aria-labelledby={`board-column-${column.status}`}
            data-slot="board-column"
            data-status={column.status}
            className="flex w-72 shrink-0 flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id={`board-column-${column.status}`} className="font-semibold text-foreground">
                {column.label}
              </h2>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-sm font-semibold tabular-nums">
                {column.total}
              </span>
            </div>
            {more > 0 &&
              (query.partner_id ? (
                // The list of bookings has no partner filter, so a link would open other bookings than the column counts.
                <span className="self-end text-sm font-semibold text-muted-foreground">+{more} more</span>
              ) : (
                <Link
                  href={moreHref(column, query)}
                  className="self-end text-sm font-semibold text-primary hover:underline"
                >
                  +{more} more
                </Link>
              ))}
            <div className="flex flex-col gap-3">
              {column.cards.map((card) => (
                <BoardBookingCard
                  key={card.id}
                  booking={card}
                  query={query}
                  selected={card.id === query.booking}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
