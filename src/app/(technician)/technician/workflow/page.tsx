import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requirePermission } from "@/lib/auth/current-user";
import { TECHNICIAN_WORKFLOW_ROUTE } from "@/lib/constants/routes";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";
import { BoardLoadError } from "@/features/workflow-board/components/board-load-error";
import { TechnicianBoardColumns } from "@/features/workflow-board/components/technician-board-columns";
import { TechnicianFilterSheet } from "@/features/workflow-board/components/technician-filter-sheet";
import { TechnicianStepCards } from "@/features/workflow-board/components/technician-step-cards";
import { TechnicianStepChips } from "@/features/workflow-board/components/technician-step-chips";
import { WorkflowBoardFilters } from "@/features/workflow-board/components/workflow-board-filters";
import { getWorkflowBoardOptions } from "@/features/workflow-board/lib/get-workflow-board-options";
import { loadWorkflowBoard } from "@/features/workflow-board/lib/load-workflow-board";
import { resolveWorkflowBoardQuery } from "@/features/workflow-board/lib/resolve-workflow-board-query";
import { resolveSelectedStep } from "@/features/workflow-board/lib/technician-board";
import { WORKFLOW_BOARD_QUERY_FIELDS } from "@/features/workflow-board/schemas/workflow-board-query.schema";

/** The filters a new search keeps (the search itself is the box). */
const KEPT_FIELDS = ["airport_id", "date", "flight_alert", "priority"] as const;

function formatBoardDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

interface TechnicianWorkflowPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The Workflow Board of a technician (CO-F08-T02): the bookings of the jobs assigned to them, in the
 * column of their step. `jobs:view_assigned` is checked here as well as in the layout. RLS decides which
 * bookings exist for the technician (their own only); a partner or a booking in the address is never
 * used, as a technician has neither a partner filter nor a preview. The step in the address only picks
 * what a phone shows. The Move button of a card asks the database function, which decides again.
 */
export default async function TechnicianWorkflowPage({ searchParams }: TechnicianWorkflowPageProps) {
  const user = await requirePermission("jobs:view_assigned");

  const raw = await searchParams;
  const options = await getWorkflowBoardOptions({ withPartners: false });
  const { query: resolved, errors } = resolveWorkflowBoardQuery(raw, { partners: [], airports: options.airports });
  const query = { ...resolved, partner_id: undefined, booking: undefined };

  const board = await loadWorkflowBoard(query);
  const selectedStep = resolveSelectedStep(raw.step, board?.columns ?? []);
  const selectedColumn = board?.columns.find((column) => column.status === selectedStep);

  const airport = options.airports.find((option) => option.value === query.airport_id);
  const subtitle = [
    `${BOOKING_BOARD_STEPS.length} workflow stages`,
    airport?.label ?? "All airports",
    query.date ? formatBoardDate(query.date) : null,
    board?.time_zone,
  ]
    .filter(Boolean)
    .join(" · ");
  const filterFields = WORKFLOW_BOARD_QUERY_FIELDS.filter((field) => field !== "booking" && field !== "partner_id");
  const filterCount = filterFields.filter((field) => query[field]).length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-4 p-4 pb-4 md:p-8 md:pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-3xl">Workflow Board</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="md:hidden">
            <TechnicianFilterSheet
              query={query}
              airports={options.airports}
              total={board?.total ?? null}
              filterCount={filterCount}
            />
          </div>
        </div>

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>{errors.join(" ")}</AlertDescription>
          </Alert>
        )}

        <form action={TECHNICIAN_WORKFLOW_ROUTE} method="get" role="search" className="md:hidden">
          {KEPT_FIELDS.map((field) => {
            const value = query[field];
            return value ? <input key={field} type="hidden" name={field} value={value} /> : null;
          })}
          <input
            type="search"
            name="q"
            defaultValue={query.q ?? ""}
            maxLength={50}
            placeholder="Search bookings"
            aria-label="Search bookings"
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </form>

        <div className="hidden md:block">
          <WorkflowBoardFilters
            // The search box keeps what was typed; a new search (or Clear filters) starts it again from the address.
            key={query.q ?? ""}
            query={query}
            partners={[]}
            airports={options.airports}
            total={board?.total ?? null}
            route={TECHNICIAN_WORKFLOW_ROUTE}
            hidePartner
            countNoun="own booking"
          />
        </div>
      </div>

      {board === null ? (
        <BoardLoadError />
      ) : board.total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/40 p-8">
          <ClipboardListIcon aria-hidden="true" className="size-10 text-muted-foreground" />
          <p className="text-lg font-semibold text-foreground">
            {filterCount > 0 ? "No bookings to show" : "No jobs are assigned to you"}
          </p>
          {filterCount > 0 && (
            <Link href={TECHNICIAN_WORKFLOW_ROUTE} className={buttonVariants({ className: "min-h-11 px-6" })}>
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="hidden flex-1 flex-col md:flex">
            <TechnicianBoardColumns columns={board.columns} query={query} role={user.role} />
          </div>
          <div className="flex flex-col gap-3 px-4 pb-24 md:hidden">
            <div className="flex items-center justify-between gap-4 text-sm">
              <p className="font-medium text-foreground">
                {board.total} own {board.total === 1 ? "booking" : "bookings"}
              </p>
              <a href="#technician-steps" className="text-primary">
                Choose step
              </a>
            </div>
            <TechnicianStepChips columns={board.columns} query={query} selected={selectedStep} />
            {selectedColumn && <TechnicianStepCards column={selectedColumn} query={query} role={user.role} />}
          </div>
        </>
      )}
    </div>
  );
}
