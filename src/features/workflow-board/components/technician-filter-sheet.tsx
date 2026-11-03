"use client";

import { useState } from "react";
import { FilterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { WorkflowBoardFilters } from "@/features/workflow-board/components/workflow-board-filters";
import type { WorkflowBoardOption } from "@/features/workflow-board/lib/resolve-workflow-board-query";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import { TECHNICIAN_WORKFLOW_ROUTE } from "@/lib/constants/routes";

interface TechnicianFilterSheetProps {
  query: WorkflowBoardQuery;
  airports: WorkflowBoardOption[];
  total: number | null;
  /** How many filters are on; shown on the button. */
  filterCount: number;
}

/** The filters of the board on a phone: a 44 px button with the number of filters on, and the filters in a sheet. */
export function TechnicianFilterSheet({ query, airports, total, filterCount }: TechnicianFilterSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button type="button" variant="outline" size="icon" className="relative size-11" aria-label={`Filters, ${filterCount} on`} />}
      >
        <FilterIcon aria-hidden="true" />
        <span className="absolute -top-1 left-5 min-w-9 rounded-full bg-secondary px-2 text-sm font-semibold">
          {filterCount}
        </span>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription className="sr-only">Narrow the bookings on the board.</SheetDescription>
        </SheetHeader>
        <WorkflowBoardFilters
          query={query}
          partners={[]}
          airports={airports}
          total={total}
          route={TECHNICIAN_WORKFLOW_ROUTE}
          hidePartner
          countNoun="own booking"
        />
      </SheetContent>
    </Sheet>
  );
}
