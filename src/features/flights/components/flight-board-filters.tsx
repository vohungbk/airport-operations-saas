"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_STATUSES_VALUE, useFlightBoardFilters } from "@/features/flights/hooks/use-flight-board-filters";
import { FLIGHT_BOARD_STATUSES, type FlightBoardQuery } from "@/features/flights/schemas/flight-board-query.schema";
import { DOMAIN_STATUS } from "@/lib/status/domain-status";

interface FlightBoardFiltersProps {
  /** The filters of the address, with the airport the board opened when none was chosen. */
  query: FlightBoardQuery;
  airports: { value: string; label: string }[];
  /** `Live provider`, `Sandbox` or `Simulator`; not shown when the configuration is not valid. */
  sourceLabel: string | null;
  lastSyncLabel: string;
}

const TRIGGER_CLASS = "h-11 w-full bg-card px-3 data-[size=default]:h-11";

const STATUS_ITEMS = [
  { value: ALL_STATUSES_VALUE, label: "All statuses" },
  ...FLIGHT_BOARD_STATUSES.map((value) => ({ value, label: DOMAIN_STATUS.flight[value].label })),
];

/** The one Client Component of the board. It reads the values from props and only moves the address. */
export function FlightBoardFilters({ query, airports, sourceLabel, lastSyncLabel }: FlightBoardFiltersProps) {
  const { isPending, setAirport, setStatus } = useFlightBoardFilters(query);

  return (
    <div
      aria-busy={isPending}
      className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 aria-busy:opacity-60"
    >
      <div className="flex w-full flex-col gap-2 sm:w-55">
        <Label htmlFor="flight-board-airport" className="font-semibold">
          Airport
        </Label>
        <Select value={query.airport_id ?? null} items={airports} onValueChange={setAirport}>
          <SelectTrigger id="flight-board-airport" className={TRIGGER_CLASS} aria-label="Filter by airport">
            <SelectValue placeholder="Airport" />
          </SelectTrigger>
          <SelectContent>
            {airports.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-55">
        <Label htmlFor="flight-board-status" className="font-semibold">
          Status
        </Label>
        <Select value={query.status ?? ALL_STATUSES_VALUE} items={STATUS_ITEMS} onValueChange={setStatus}>
          <SelectTrigger id="flight-board-status" className={TRIGGER_CLASS} aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ITEMS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sourceLabel && (
        <p className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          <span>{sourceLabel}</span>
          <span>{lastSyncLabel}</span>
        </p>
      )}

      <Link href="/flights" className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
        Clear filters
      </Link>
    </div>
  );
}
