"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  flightAlertFilterLabel,
  priorityFilterLabel,
  useWorkflowBoardFilters,
} from "@/features/workflow-board/hooks/use-workflow-board-filters";
import { cn } from "@/lib/utils";
import type { WorkflowBoardOption } from "@/features/workflow-board/lib/resolve-workflow-board-query";
import {
  FLIGHT_ALERT_FILTERS,
  PRIORITY_FILTERS,
  type WorkflowBoardQuery,
} from "@/features/workflow-board/schemas/workflow-board-query.schema";

const ALL_VALUE = "all";
const SELECT_TRIGGER_CLASS =
  "h-11 w-full flex-row-reverse justify-end gap-2 bg-card px-4 font-medium data-[size=default]:h-11 sm:w-fit";
// The filter bar of the design (CO-F08-T01, Figma D4): fixed widths, text on the left and the arrow on the right.
const BAR_SELECT_TRIGGER_CLASS =
  "h-11 w-full justify-between rounded-md bg-card px-3 data-[size=default]:h-11 sm:w-36";

const FLIGHT_ALERT_OPTIONS = FLIGHT_ALERT_FILTERS.map((value) => ({
  value,
  label: flightAlertFilterLabel(value),
}));
const PRIORITY_OPTIONS = PRIORITY_FILTERS.map((value) => ({
  value,
  label: priorityFilterLabel(value),
}));

interface WorkflowBoardFiltersProps {
  query: WorkflowBoardQuery;
  partners: WorkflowBoardOption[];
  airports: WorkflowBoardOption[];
  /** Bookings in view, across all columns; `null` when the board could not be read. */
  total: number | null;
  /** The board the filters change the address of; the admin board when not given. */
  route?: string;
  /** Leaves the partner filter out: a technician does not see partners (CO-F08-T02). */
  hidePartner?: boolean;
  /** The noun of the count: "7 bookings in view" for the office, "7 own bookings in view" for a technician. */
  countNoun?: string;
  /** The filter bar of the Workflow Board design: one row on a white band, the labels "All alerts" and "All priority". */
  bar?: boolean;
}

function toValue(value: string | null): string {
  return !value || value === ALL_VALUE ? "" : value;
}

/** The filter bar: the one Client Component of the board. The logic is in `useWorkflowBoardFilters`. */
export function WorkflowBoardFilters({
  query,
  partners,
  airports,
  total,
  route,
  hidePartner = false,
  countNoun = "booking",
  bar = false,
}: WorkflowBoardFiltersProps) {
  const { searchInput, setSearchInput, error, chips, navigate, submitSearch, clearFilters, removeFilter } =
    useWorkflowBoardFilters(query, partners, airports, route);

  const triggerClass = bar ? BAR_SELECT_TRIGGER_CLASS : SELECT_TRIGGER_CLASS;
  const alertAll = bar ? "All alerts" : "Flight alert: All";
  const priorityAll = bar ? "All priority" : "Priority: All";
  const hasFilters = chips.length > 0;

  return (
    <div
      className={bar ? "flex flex-col gap-2 border-b border-border bg-card px-4 py-2" : "flex flex-col gap-3"}
      data-slot={bar ? "board-filter-bar" : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!hidePartner && (
        <Select
          value={query.partner_id ?? ALL_VALUE}
          items={[{ value: ALL_VALUE, label: "All partners" }, ...partners]}
          onValueChange={(value) => navigate({ partner_id: toValue(value) })}
        >
          <SelectTrigger className={triggerClass} aria-label="Filter by partner">
            <SelectValue placeholder="All partners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All partners</SelectItem>
            {partners.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}

        <Select
          value={query.airport_id ?? ALL_VALUE}
          items={[{ value: ALL_VALUE, label: "All airports" }, ...airports]}
          onValueChange={(value) => navigate({ airport_id: toValue(value) })}
        >
          <SelectTrigger className={triggerClass} aria-label="Filter by airport">
            <SelectValue placeholder="All airports" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All airports</SelectItem>
            {airports.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DatePicker
          value={query.date}
          onValueChange={(value) => navigate({ date: value })}
          placeholder="Pickup date"
          className={bar ? "h-11 w-full rounded-md bg-card px-3 sm:w-41" : "h-11 w-full bg-card px-4 sm:w-44"}
        />

        <form onSubmit={submitSearch} role="search" className={bar ? "flex w-full items-center sm:w-51" : "flex w-full items-center sm:w-56"}>
          <SearchInput
            placeholder={bar ? "Booking number" : "Booking search"}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className={bar ? "h-11 rounded-md" : "h-11"}
            aria-label="Search bookings"
          />
        </form>

        <Select
          value={query.flight_alert ?? ALL_VALUE}
          items={[{ value: ALL_VALUE, label: alertAll }, ...FLIGHT_ALERT_OPTIONS]}
          onValueChange={(value) => navigate({ flight_alert: toValue(value) })}
        >
          <SelectTrigger className={triggerClass} aria-label="Filter by flight alert">
            <SelectValue placeholder={alertAll} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{alertAll}</SelectItem>
            {FLIGHT_ALERT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={query.priority ?? ALL_VALUE}
          items={[{ value: ALL_VALUE, label: priorityAll }, ...PRIORITY_OPTIONS]}
          onValueChange={(value) => navigate({ priority: toValue(value) })}
        >
          <SelectTrigger className={triggerClass} aria-label="Filter by priority">
            <SelectValue placeholder={priorityAll} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{priorityAll}</SelectItem>
            {PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          // The design draws Clear filters grey while no filter is set; it is still a button that works.
          data-idle={bar && !hasFilters ? "true" : undefined}
          className={cn("min-h-11 px-4", bar && "w-47 rounded-md font-semibold", bar && !hasFilters && "bg-muted")}
          onClick={clearFilters}
        >
          Clear filters
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger-fg">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-foreground">
          {total === null ? "—" : total} {total === 1 ? countNoun : `${countNoun}s`} in view
        </p>
        {chips.map((chip) => (
          <Button
            key={chip.field}
            type="button"
            variant="secondary"
            size="sm"
            aria-label={`Remove filter ${chip.label}`}
            onClick={() => removeFilter(chip.field)}
          >
            {chip.label}
            <XIcon aria-hidden="true" />
          </Button>
        ))}
      </div>
    </div>
  );
}
