"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildJobsHref } from "@/features/jobs/lib/build-jobs-href";
import { getJobSearchError } from "@/features/jobs/lib/job-search";
import {
  JOB_STATUSES,
  JOB_STATUS_LABEL,
  type JobStatus,
} from "@/features/jobs/lib/job-status";
import {
  JOB_TYPES,
  JOB_TYPE_LABEL,
  type JobType,
} from "@/features/jobs/lib/job-type";
import { formatDateRangeLabel, zoneLabel } from "@/features/jobs/lib/job-time";
import type { JobsQuery } from "@/features/jobs/schemas/jobs-query.schema";
import type { JobAirportOption, TechnicianOption } from "@/features/jobs/types";

const ALL_VALUE = "all";

const TRIGGER_CLASS =
  "h-11 w-full rounded-lg border-border-input bg-surface px-3 text-sm data-[size=default]:h-11";

interface JobsFiltersProps {
  query: JobsQuery;
  /** `null` hides the technician filter (a technician sees only their own jobs). */
  technicians: TechnicianOption[] | null;
  airports: JobAirportOption[];
  /** The zone the date range is read in. */
  timeZone: string;
  /** Where Clear filters goes; the sort stays. */
  clearHref: string;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
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
 * The one Client Component this route needs: the filter card of the design. Search is validated with the
 * same rule the server uses; every filter change goes back to page 1 and lives in the URL.
 */
export function JobsFilters({ query, technicians, airports, timeZone, clearHref }: JobsFiltersProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query.q ?? "");
  const [searchError, setSearchError] = useState<string | null>(null);

  function go(overrides: Partial<JobsQuery>) {
    router.push(buildJobsHref(query, { ...overrides, page: 1 }));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error = getJobSearchError(searchInput);
    setSearchError(error);

    if (!error) go({ q: searchInput.trim() || undefined });
  }

  const rangeLabel = formatDateRangeLabel(query.from, query.to, timeZone);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <form onSubmit={handleSearchSubmit} role="search" noValidate>
          <Field label="Search" htmlFor="job-search">
            <Input
              id="job-search"
              placeholder="Job, seat or booking"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-11 w-full rounded-lg border-border-input bg-surface px-3 text-sm"
              aria-invalid={searchError !== null}
              aria-describedby={searchError ? "job-search-error" : undefined}
            />
          </Field>
        </form>

        <Field label="Status" htmlFor="job-status-filter">
          <Select
            value={query.status ?? ALL_VALUE}
            items={[
              { value: ALL_VALUE, label: "All statuses" },
              ...JOB_STATUSES.map((value) => ({ value, label: JOB_STATUS_LABEL[value] })),
            ]}
            onValueChange={(value) =>
              go({ status: !value || value === ALL_VALUE ? undefined : (value as JobStatus) })
            }
          >
            <SelectTrigger id="job-status-filter" className={TRIGGER_CLASS} aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
              {JOB_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {JOB_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Type" htmlFor="job-type-filter">
          <Select
            value={query.type ?? ALL_VALUE}
            items={[
              { value: ALL_VALUE, label: "All types" },
              ...JOB_TYPES.map((value) => ({ value, label: JOB_TYPE_LABEL[value] })),
            ]}
            onValueChange={(value) =>
              go({ type: !value || value === ALL_VALUE ? undefined : (value as JobType) })
            }
          >
            <SelectTrigger id="job-type-filter" className={TRIGGER_CLASS} aria-label="Filter by type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All types</SelectItem>
              {JOB_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {JOB_TYPE_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {technicians && (
          <Field label="Technician" htmlFor="job-technician-filter">
            <Select
              value={query.technician_id ?? ALL_VALUE}
              items={[
                { value: ALL_VALUE, label: "All technicians" },
                ...technicians.map((t) => ({ value: t.id, label: t.full_name })),
              ]}
              onValueChange={(value) =>
                go({ technician_id: !value || value === ALL_VALUE ? undefined : value })
              }
            >
              <SelectTrigger
                id="job-technician-filter"
                className={TRIGGER_CLASS}
                aria-label="Filter by technician"
              >
                <SelectValue placeholder="All technicians" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All technicians</SelectItem>
                {technicians.map((technician) => (
                  <SelectItem key={technician.id} value={technician.id}>
                    {technician.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Airport" htmlFor="job-airport-filter">
          <Select
            value={query.airport_id ?? ALL_VALUE}
            items={[
              { value: ALL_VALUE, label: "All airports" },
              ...airports.map((a) => ({ value: a.id, label: a.code })),
            ]}
            onValueChange={(value) => go({ airport_id: !value || value === ALL_VALUE ? undefined : value })}
          >
            <SelectTrigger id="job-airport-filter" className={TRIGGER_CLASS} aria-label="Filter by airport">
              <SelectValue placeholder="All airports" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All airports</SelectItem>
              {airports.map((airport) => (
                <SelectItem key={airport.id} value={airport.id}>
                  {airport.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="flex min-w-0 flex-col gap-2">
          <span id="job-date-range-label" className="text-sm font-semibold">
            Date range
          </span>
          <Popover>
            <PopoverTrigger
              aria-labelledby="job-date-range-label"
              className={cn(
                "flex h-11 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-border-input bg-surface px-3 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                !rangeLabel && "text-muted-foreground",
              )}
            >
              <span className="min-w-0 truncate">{rangeLabel || "All dates"}</span>
              <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className="flex flex-col gap-3 p-3 sm:flex-row">
              <div className="flex flex-col gap-1">
                <span className="px-2 text-sm font-semibold">From</span>
                <Calendar value={query.from} max={query.to} onValueChange={(value) => go({ from: value })} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="px-2 text-sm font-semibold">To</span>
                <Calendar value={query.to} min={query.from} onValueChange={(value) => go({ to: value })} />
              </div>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-text-muted">Airport time zone: {zoneLabel(timeZone)}</p>
        </div>
      </div>

      {searchError && (
        <p id="job-search-error" role="alert" className="text-sm text-danger-fg">
          {searchError}
        </p>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(clearHref)}
          className="min-h-11 rounded-lg bg-surface px-4"
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
