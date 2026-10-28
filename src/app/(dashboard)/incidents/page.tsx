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
import { parseIncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";
import { IncidentsFilters } from "@/features/incidents/components/incidents-filters";
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
  const { incidents, total } = await getIncidents(query);
  const hasFilters = Boolean(query.q || query.status || query.severity);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Incidents
          </h1>
          {canReport && (
            <Link
              href="/incidents/new"
              className={buttonVariants({ className: "min-h-11 px-4" })}
            >
              <PlusIcon aria-hidden="true" />
              Report incident
            </Link>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {total} incident{total === 1 ? "" : "s"}
        </p>
      </div>

      <IncidentsFilters
        // The search box keeps what was typed; a new search starts it again from the address.
        key={query.q ?? ""}
        query={query}
      />

      {search_error && (
        <Alert variant="destructive">
          <AlertTitle>Search not applied</AlertTitle>
          <AlertDescription>{search_error}</AlertDescription>
        </Alert>
      )}

      {total === 0 ? (
        <PageEmpty
          message={
            hasFilters
              ? "No incidents match the search or filters."
              : "No incidents yet."
          }
        />
      ) : (
        <>
          <IncidentsTable incidents={incidents} query={query} />
          <IncidentsPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
