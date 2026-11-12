"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildIncidentsHref } from "@/features/incidents/lib/build-incidents-href";
import type { IncidentSeatOption } from "@/features/incidents/lib/get-incident-seat-options";
import { getIncidentSearchError } from "@/features/incidents/lib/incident-search";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABEL,
  type IncidentSeverity,
} from "@/features/incidents/lib/incident-severity";
import {
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABEL,
  type IncidentStatus,
} from "@/features/incidents/lib/incident-status";
import { formatDateRangeLabel, zoneLabel } from "@/features/jobs/lib/job-time";
import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

const ALL_VALUE = "all";

const TRIGGER_CLASS =
  "h-11 w-full rounded-lg border-border-input bg-surface px-3 text-sm data-[size=default]:h-11";

interface IncidentsFiltersProps {
  query: IncidentsQuery;
  seats: IncidentSeatOption[];
  /** The zone the date range is read in. */
  timeZone: string;
  /** Where Clear filters goes; the sort stays. */
  clearHref: string;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * The one Client Component this route needs: the filter card of the design.
 * Search is validated with the same rule the server uses; every filter change
 * goes back to page 1 and lives in the URL.
 */
export function IncidentsFilters({
  query,
  seats,
  timeZone,
  clearHref,
}: IncidentsFiltersProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query.q ?? "");
  const [searchError, setSearchError] = useState<string | null>(null);

  function go(overrides: Partial<IncidentsQuery>) {
    router.push(buildIncidentsHref(query, { ...overrides, page: 1 }));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error = getIncidentSearchError(searchInput);
    setSearchError(error);

    if (!error) go({ q: searchInput.trim() || undefined });
  }

  const rangeLabel = formatDateRangeLabel(query.from, query.to, timeZone);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <form onSubmit={handleSearchSubmit} role="search" noValidate>
          <Field label="Search" htmlFor="incident-search">
            <Input
              id="incident-search"
              placeholder="Type or description"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-11 w-full rounded-lg border-border-input bg-surface px-3 text-sm"
              aria-invalid={searchError !== null}
              aria-describedby={
                searchError ? "incident-search-error" : undefined
              }
            />
          </Field>
        </form>

        <Field label="Status" htmlFor="incident-status-filter">
          <Select
            value={query.status ?? ALL_VALUE}
            items={[
              { value: ALL_VALUE, label: "All statuses" },
              ...INCIDENT_STATUSES.map((value) => ({
                value,
                label: INCIDENT_STATUS_LABEL[value],
              })),
            ]}
            onValueChange={(value) =>
              go({
                status:
                  !value || value === ALL_VALUE
                    ? undefined
                    : (value as IncidentStatus),
              })
            }
          >
            <SelectTrigger
              id="incident-status-filter"
              className={TRIGGER_CLASS}
              aria-label="Filter by status"
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
              {INCIDENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {INCIDENT_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Severity" htmlFor="incident-severity-filter">
          <Select
            value={query.severity ?? ALL_VALUE}
            items={[
              { value: ALL_VALUE, label: "All severities" },
              ...INCIDENT_SEVERITIES.map((value) => ({
                value,
                label: INCIDENT_SEVERITY_LABEL[value],
              })),
            ]}
            onValueChange={(value) =>
              go({
                severity:
                  !value || value === ALL_VALUE
                    ? undefined
                    : (value as IncidentSeverity),
              })
            }
          >
            <SelectTrigger
              id="incident-severity-filter"
              className={TRIGGER_CLASS}
              aria-label="Filter by severity"
            >
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All severities</SelectItem>
              {INCIDENT_SEVERITIES.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {INCIDENT_SEVERITY_LABEL[severity]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Seat" htmlFor="incident-seat-filter">
          <Select
            value={query.seat_id ?? ALL_VALUE}
            items={[
              { value: ALL_VALUE, label: "All seats" },
              ...seats.map((seat) => ({
                value: seat.id,
                label: seat.serial_number,
              })),
            ]}
            onValueChange={(value) =>
              go({ seat_id: !value || value === ALL_VALUE ? undefined : value })
            }
          >
            <SelectTrigger
              id="incident-seat-filter"
              className={TRIGGER_CLASS}
              aria-label="Filter by seat"
            >
              <SelectValue placeholder="All seats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All seats</SelectItem>
              {seats.map((seat) => (
                <SelectItem key={seat.id} value={seat.id}>
                  {seat.serial_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="flex min-w-0 flex-col gap-2">
          <span id="incident-date-range-label" className="text-sm font-semibold">
            Date range
          </span>
          <Popover>
            <PopoverTrigger
              aria-labelledby="incident-date-range-label"
              className={cn(
                "flex h-11 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-border-input bg-surface px-3 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                !rangeLabel && "text-muted-foreground",
              )}
            >
              <span className="min-w-0 truncate">
                {rangeLabel || "All dates"}
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
            </PopoverTrigger>
            <PopoverContent className="flex flex-col gap-3 p-3 sm:flex-row">
              <div className="flex flex-col gap-1">
                <span className="px-2 text-sm font-semibold">From</span>
                <Calendar
                  value={query.from}
                  max={query.to}
                  onValueChange={(value) => go({ from: value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="px-2 text-sm font-semibold">To</span>
                <Calendar
                  value={query.to}
                  min={query.from}
                  onValueChange={(value) => go({ to: value })}
                />
              </div>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-text-muted">
            Airport time zone: {zoneLabel(timeZone)}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          {/* Same height as the labels of the other fields, so the button lines up with the inputs. */}
          <span aria-hidden="true" className="invisible text-sm font-semibold">
            Clear
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(clearHref)}
            className="h-11 w-fit rounded-lg bg-surface px-4"
          >
            Clear filters
          </Button>
        </div>
      </div>

      {searchError && (
        <p
          id="incident-search-error"
          role="alert"
          className="text-sm text-danger-fg"
        >
          {searchError}
        </p>
      )}
    </div>
  );
}
