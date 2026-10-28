"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

import { SearchInput } from "@/components/ui/input-group";
import { TextLink } from "@/components/ui/text-link";
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
  const pathname = usePathname();
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
      buildIncidentsHref(query, {
        q: searchInput.trim() || undefined,
        page: 1,
      }),
    );
  }

  const hasFilters = Boolean(query.q || query.status || query.severity);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          noValidate
          className="flex w-full items-center gap-2 sm:w-72"
        >
          <SearchInput
            placeholder="Search type or description…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="h-11"
            aria-label="Search incidents"
            aria-invalid={searchError !== null}
            aria-describedby={searchError ? "incident-search-error" : undefined}
          />
        </form>

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
          <SelectTrigger
            className="h-11 w-full bg-card px-4 font-medium data-[size=default]:h-11 sm:w-fit"
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
          <SelectTrigger
            className="h-11 w-full bg-card px-4 font-medium data-[size=default]:h-11 sm:w-fit"
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

        {hasFilters && (
          <TextLink
            href={`${pathname}?sort=${query.sort}&order=${query.order}`}
            className="text-muted-foreground"
          >
            Clear all
          </TextLink>
        )}
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
