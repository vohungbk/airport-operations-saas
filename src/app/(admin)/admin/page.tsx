import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/current-user";
import { WORKFLOW_BOARD_ROUTE } from "@/lib/constants/routes";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";
import { getBookingEvents } from "@/features/bookings/lib/get-booking-events";
import { getBookingById } from "@/features/bookings/lib/get-booking-by-id";
import { BookingPreview } from "@/features/workflow-board/components/booking-preview";
import { WorkflowBoardColumns } from "@/features/workflow-board/components/workflow-board-columns";
import { WorkflowBoardFilters } from "@/features/workflow-board/components/workflow-board-filters";
import { buildWorkflowBoardHref } from "@/features/workflow-board/lib/build-workflow-board-href";
import { getWorkflowBoard } from "@/features/workflow-board/lib/get-workflow-board";
import { getWorkflowBoardOptions } from "@/features/workflow-board/lib/get-workflow-board-options";
import { resolveWorkflowBoardQuery } from "@/features/workflow-board/lib/resolve-workflow-board-query";

interface AdminPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The Workflow Board (CO-F08-S01): the bookings in scope, in the column of the step they are at. Admin and
 * operations manager only (`dashboards:view`), checked here as well as in the layout. RLS decides which
 * bookings exist for the person; the filters only narrow them. Moving a booking between steps is not part
 * of this story. A booking that is not visible or does not exist opens no preview.
 */
export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requirePermission("dashboards:view");

  const options = await getWorkflowBoardOptions();
  const { query, errors } = resolveWorkflowBoardQuery(await searchParams, options);

  // The preview needs only the booking id, so the booking and its events are read with the board.
  const [board, booking, events] = await Promise.all([
    getWorkflowBoard(query),
    query.booking ? getBookingById(query.booking) : null,
    query.booking ? getBookingEvents(query.booking) : null,
  ]);

  const airport = options.airports.find((option) => option.value === query.airport_id);
  const subtitle = `${BOOKING_BOARD_STEPS.length} workflow stages · ${airport?.label ?? "All airports"}`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-4 p-8 pb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Workflow Board</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>{errors.join(" ")}</AlertDescription>
          </Alert>
        )}

        <WorkflowBoardFilters
          // The search box keeps what was typed; a new search (or Clear filters) starts it again from the address.
          key={query.q ?? ""}
          query={query}
          partners={options.partners}
          airports={options.airports}
          total={board.total}
        />
      </div>

      {board.total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/40 p-8">
          <ClipboardListIcon aria-hidden="true" className="size-10 text-muted-foreground" />
          <p className="text-lg font-semibold text-foreground">No bookings to show</p>
          <Link href={WORKFLOW_BOARD_ROUTE} className={buttonVariants({ className: "min-h-11 px-6" })}>
            Clear filters
          </Link>
        </div>
      ) : (
        <WorkflowBoardColumns columns={board.columns} query={query} />
      )}

      {booking && events && (
        <BookingPreview
          booking={booking}
          events={events}
          closeHref={buildWorkflowBoardHref({ ...query, booking: undefined })}
        />
      )}
    </div>
  );
}
