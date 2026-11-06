import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";

import { BoardBookingCard } from "@/features/workflow-board/components/board-booking-card";
import type { BoardColumn } from "@/features/workflow-board/lib/get-workflow-board";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import type { Role } from "@/lib/auth/roles";

interface WorkflowBoardColumnsProps {
  columns: BoardColumn[];
  query: WorkflowBoardQuery;
  role: Role;
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

/**
 * One column per step of the booking path, each with its count and its cards, as the Figma frame D4 draws them: 280
 * wide, a header with the step and the count, a fade at the right edge and "Scroll for more" under the board.
 */
export function WorkflowBoardColumns({ columns, query, role }: WorkflowBoardColumnsProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background" data-slot="workflow-board">
      <div className="flex flex-1 gap-4 overflow-x-auto p-4 pt-2">
        {columns.map((column) => {
          const more = column.total - column.cards.length;

          return (
            <section
              key={column.status}
              aria-labelledby={`board-column-${column.status}`}
              data-slot="board-column"
              data-status={column.status}
              className="flex w-70 shrink-0 flex-col rounded-md bg-muted"
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <ClipboardListIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                <h2 id={`board-column-${column.status}`} className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">
                  {column.label}
                </h2>
                <span
                  data-slot="board-column-count"
                  className="flex h-7 min-w-[30px] items-center justify-center rounded-[7px] bg-primary-subtle px-1.5 text-body font-semibold tabular-nums text-foreground"
                >
                  {column.total}
                </span>
              </div>
              <div className="flex max-h-[calc(100dvh-24rem)] min-h-24 flex-col gap-4 overflow-y-auto px-2 pb-2">
                {column.cards.length === 0 && (
                  <p className="rounded-md border border-dashed border-border p-4 text-body text-muted-foreground">
                    No bookings in this step
                  </p>
                )}
                {column.cards.map((card) => (
                  <BoardBookingCard
                    key={card.id}
                    booking={card}
                    query={query}
                    selected={card.id === query.booking}
                    role={role}
                  />
                ))}
                {more > 0 &&
                  (query.partner_id ? (
                    // The list of bookings has no partner filter, so a link would open other bookings than the column counts.
                    <span className="text-body font-semibold text-muted-foreground">+{more} more</span>
                  ) : (
                    <Link href={moreHref(column, query)} className="text-body font-semibold text-primary hover:underline">
                      +{more} more
                    </Link>
                  ))}
              </div>
            </section>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        data-slot="board-scroll-fade"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-40 bg-linear-to-l from-background to-transparent md:block"
      />
      <p data-slot="board-scroll-hint" className="hidden px-4 pb-3 text-right text-body text-muted-foreground md:block">
        Scroll for more
      </p>
    </div>
  );
}
