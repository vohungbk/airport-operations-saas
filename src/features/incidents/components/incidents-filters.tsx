"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildIncidentsHref } from "@/features/incidents/lib/build-incidents-href";
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
import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

const ALL_VALUE = "all";

interface IncidentsFiltersProps {
  query: IncidentsQuery;
}

/**
 * The one Client Component this route needs. Search is validated with the
 * same rule the server uses; a new search or filter goes back to page 1.
 */
export function IncidentsFilters({ query }: IncidentsFiltersProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query.q ?? "");
  const [searchError, setSearchError] = useState<string | null>(null);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error = getIncidentSearchError(searchInput);
    setSearchError(error);

    if (error) {
      return;
    }

    router.push(
      buildIncidentsHref(query, { q: searchInput.trim() || undefined, page: 1 }),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          noValidate
          className="flex w-full items-center gap-2 sm:w-auto"
        >
          <Input
            placeholder="Search by type or description..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="min-w-0 flex-1 sm:w-72 sm:flex-none"
            aria-label="Search incidents"
            aria-invalid={searchError !== null}
            aria-describedby={searchError ? "incident-search-error" : undefined}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <Select
          value={query.status ?? ALL_VALUE}
          onValueChange={(value) =>
            router.push(
              buildIncidentsHref(query, {
                status:
                  !value || value === ALL_VALUE
                    ? undefined
                    : (value as IncidentStatus),
                page: 1,
              }),
            )
          }
        >
          <SelectTrigger className="w-44" aria-label="Filter by status">
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

        <Select
          value={query.severity ?? ALL_VALUE}
          onValueChange={(value) =>
            router.push(
              buildIncidentsHref(query, {
                severity:
                  !value || value === ALL_VALUE
                    ? undefined
                    : (value as IncidentSeverity),
                page: 1,
              }),
            )
          }
        >
          <SelectTrigger className="w-44" aria-label="Filter by severity">
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
      </div>

      {searchError && (
        <p
          id="incident-search-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {searchError}
        </p>
      )}
    </div>
  );
}
