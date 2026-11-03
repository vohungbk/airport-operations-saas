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
import type { WorkflowBoardOption } from "@/features/workflow-board/lib/resolve-workflow-board-query";
import {
  FLIGHT_ALERT_FILTERS,
  PRIORITY_FILTERS,
  type WorkflowBoardQuery,
} from "@/features/workflow-board/schemas/workflow-board-query.schema";

const ALL_VALUE = "all";
const SELECT_TRIGGER_CLASS =
  "h-11 w-full flex-row-reverse justify-end gap-2 bg-card px-4 font-medium data-[size=default]:h-11 sm:w-fit";

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
}

function toValue(value: string | null): string {
  return !value || value === ALL_VALUE ? "" : value;
}

/** The filter bar: the one Client Component of the board. The logic is in `useWorkflowBoardFilters`. */
export function WorkflowBoardFilters({ query, partners, airports, total }: WorkflowBoardFiltersProps) {
  const { searchInput, setSearchInput, error, chips, navigate, submitSearch, clearFilters, removeFilter } =
    useWorkflowBoardFilters(query, partners, airports);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={query.partner_id ?? ALL_VALUE}
          items={[{ value: ALL_VALUE, label: "All partners" }, ...partners]}
          onValueChange={(value) => navigate({ partner_id: toValue(value) })}
        >
          <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Filter by partner">
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

        <Select
          value={query.airport_id ?? ALL_VALUE}
          items={[{ value: ALL_VALUE, label: "All airports" }, ...airports]}
          onValueChange={(value) => navigate({ airport_id: toValue(value) })}
        >
          <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Filter by airport">
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
          className="h-11 w-full bg-card px-4 sm:w-44"
        />

        <form onSubmit={submitSearch} role="search" className="flex w-full items-center sm:w-56">
          <SearchInput
            placeholder="Booking search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="h-11"
            aria-label="Search bookings"
          />
        </form>

        <Select
          value={query.flight_alert ?? ALL_VALUE}
          items={[{ value: ALL_VALUE, label: "Flight alert: All" }, ...FLIGHT_ALERT_OPTIONS]}
          onValueChange={(value) => navigate({ flight_alert: toValue(value) })}
        >
          <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Filter by flight alert">
            <SelectValue placeholder="Flight alert: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Flight alert: All</SelectItem>
            {FLIGHT_ALERT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={query.priority ?? ALL_VALUE}
          items={[{ value: ALL_VALUE, label: "Priority: All" }, ...PRIORITY_OPTIONS]}
          onValueChange={(value) => navigate({ priority: toValue(value) })}
        >
          <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Filter by priority">
            <SelectValue placeholder="Priority: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Priority: All</SelectItem>
            {PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" className="min-h-11 px-4" onClick={clearFilters}>
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
          {total === null ? "—" : total} {total === 1 ? "booking" : "bookings"} in view
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
