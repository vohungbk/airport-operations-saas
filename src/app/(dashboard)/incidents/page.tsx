import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  INCIDENTS_ACCESS_PERMISSIONS,
  INCIDENT_REPORT_PERMISSIONS,
  hasAnyPermission,
} from "@/lib/auth/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { PageEmpty } from "@/components/shared/page-state";
import { getIncidents } from "@/features/incidents/lib/get-incidents";
import { getIncidentSeatOptions } from "@/features/incidents/lib/get-incident-seat-options";
import {
  getJobAirportOptions,
  getJobsTimeZone,
} from "@/features/jobs/lib/get-job-airport-options";
import { parseIncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";
import { IncidentsFilters } from "@/features/incidents/components/incidents-filters";
import { IncidentsStatusChips } from "@/features/incidents/components/incidents-status-chips";
import { IncidentsPagination } from "@/features/incidents/components/incidents-pagination";
import { IncidentsTable } from "@/features/incidents/components/incidents-table";

interface IncidentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second guard alongside the layout's: same defense-in-depth
 * precedent as the other list routes. RLS scopes the rows.
 */
export default async function IncidentsPage({
  searchParams,
}: IncidentsPageProps) {
  const user = await requireAnyPermission(INCIDENTS_ACCESS_PERMISSIONS);
  const canReport = hasAnyPermission(user.role, INCIDENT_REPORT_PERMISSIONS);

  const { query, search_error } = parseIncidentsQuery(await searchParams);
  const [airports, seats] = await Promise.all([
    getJobAirportOptions(),
    getIncidentSeatOptions(),
  ]);
  const timeZone = getJobsTimeZone(airports, undefined);
  const { incidents, total } = await getIncidents(query, timeZone);

  const clearHref = `/incidents?sort=${query.sort}&order=${query.order}`;
  const hasFilters = Boolean(
    query.q ||
      query.status ||
      query.severity ||
      query.seat_id ||
      query.from ||
      query.to,
  );
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl leading-8 font-semibold text-primary-subtle-foreground">
          Incidents
        </h1>
        {canReport && (
          <Link
            href="/incidents/new"
            className={buttonVariants({
              className: "min-h-11 w-fit px-4",
            })}
          >
            <PlusIcon aria-hidden="true" />
            Report incident
          </Link>
        )}
      </div>

      <IncidentsFilters
        // The search box keeps what was typed; a new search starts it again from the address.
        key={query.q ?? ""}
        query={query}
        seats={seats}
        timeZone={timeZone}
        clearHref={clearHref}
      />

      <IncidentsStatusChips query={query} />

      {search_error && (
        <Alert variant="destructive">
          <AlertTitle>Search not applied</AlertTitle>
          <AlertDescription>{search_error}</AlertDescription>
        </Alert>
      )}

      {total === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
          <PageEmpty
            message={
              hasFilters
                ? "No incidents match the search or filters."
                : "No incidents yet."
            }
          />
          {hasFilters && (
            <Link
              href={clearHref}
              className={buttonVariants({
                variant: "outline",
                className: "min-h-11 rounded-lg bg-surface px-4",
              })}
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <IncidentsTable incidents={incidents} timeZone={timeZone} />
          <div className="border-t border-border">
            <IncidentsPagination query={query} total={total} />
          </div>
        </div>
      )}

      <p className="text-xs leading-4 text-text-muted">
        {`${total} incident${total === 1 ? "" : "s"} - page ${Math.min(query.page, totalPages)} of ${totalPages}`}
        <br />
        Append-only history. No delete actions.
      </p>
    </div>
  );
}
