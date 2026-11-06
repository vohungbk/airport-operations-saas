import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { WORKFLOW_BOARD_ROUTE } from "@/lib/constants/routes";

interface BoardEmptyStateProps {
  /** True when a filter is set: Clear filters is offered, as no booking may match only because of the filters. */
  hasFilters: boolean;
}

/**
 * No booking is in scope (CO-F08-T01, Figma D4 Empty): a clipboard, the sentence and, when filters are set, the
 * Clear filters button that opens the board again without them.
 */
export function BoardEmptyState({ hasFilters }: BoardEmptyStateProps) {
  return (
    <div
      data-slot="board-empty"
      className="flex flex-1 flex-col items-center justify-center gap-5 bg-background p-8"
    >
      <ClipboardListIcon aria-hidden="true" className="size-16 text-muted-foreground" strokeWidth={1.25} />
      <p className="text-h2 font-semibold text-foreground">No bookings to show</p>
      {hasFilters && (
        <Link href={WORKFLOW_BOARD_ROUTE} className={buttonVariants({ className: "min-h-11 w-60 rounded-md font-semibold" })}>
          Clear filters
        </Link>
      )}
    </div>
  );
}
