import { ChevronDownIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";

/** The skeleton columns of the design: how many, and how many cards in each. */
const SKELETON_COLUMNS = 4;
const SKELETON_CARDS = 2;
/** Six lines to a card, wide and narrow in turn. */
const SKELETON_LINES = ["w-full", "w-[70%]", "w-full", "w-[70%]", "w-full", "w-[70%]"] as const;

/** The filters as the bar draws them, with the width of each; shown only, they do nothing while the board loads. */
const FILTERS = [
  { label: "All partners", width: "sm:w-36" },
  { label: "All airports", width: "sm:w-36" },
  { label: "Pickup date", width: "sm:w-41" },
  { label: "Booking number", width: "sm:w-51" },
  { label: "All alerts", width: "sm:w-36" },
  { label: "All priority", width: "sm:w-36" },
] as const;

/**
 * The board while it loads (CO-F08-T01, Figma D4 Loading): the page header and the filter bar stay, the count is a dash,
 * and the columns are skeletons with cards of lines. The filters are drawn, not live: they need the data of the page
 * and do nothing until the board is there. The page says "Loading" once, for assistive technology; the skeleton blocks are hidden from it.
 */
export function WorkflowBoardLoading() {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-1 border-b border-border bg-card px-6 py-3">
        <h1 className="text-h2 font-semibold text-foreground">Workflow Board</h1>
        <p className="text-body text-muted-foreground">{`${BOOKING_BOARD_STEPS.length} workflow stages`}</p>
      </div>

      <div
        data-slot="board-loading-filters"
        aria-hidden="true"
        className="flex flex-col gap-2 border-b border-border bg-card px-4 py-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => (
            <span
              key={filter.label}
              className={`flex h-11 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-sm ${filter.width}`}
            >
              {filter.label}
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </span>
          ))}
          <span className="flex h-11 w-47 items-center justify-center rounded-md border border-border bg-muted text-sm font-semibold">
            Clear filters
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground">— bookings</p>
      </div>

      <div data-slot="board-loading" className="flex flex-1 gap-4 overflow-hidden bg-background p-6">
        {Array.from({ length: SKELETON_COLUMNS }, (_, column) => (
          <div key={column} data-slot="board-skeleton-column" className="flex w-70 shrink-0 flex-col gap-4 rounded-md bg-muted p-2">
            {Array.from({ length: SKELETON_CARDS }, (_, card) => (
              <div key={card} className="flex h-[270px] flex-col gap-[23px] rounded-md bg-card px-4 pt-5">
                {SKELETON_LINES.map((width, line) => (
                  <Skeleton key={line} className={`h-4 rounded-sm bg-border ${width}`} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
