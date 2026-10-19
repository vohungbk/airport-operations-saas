import { requireAnyPermission } from "@/lib/auth/current-user";
import { INCIDENTS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  await requireAnyPermission(INCIDENTS_ACCESS_PERMISSIONS);

  const { query, search_error } = parseIncidentsQuery(await searchParams);
  const { incidents, total } = await getIncidents(query);
  const hasFilters = Boolean(query.q || query.status || query.severity);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Incidents
      </h1>

      <IncidentsFilters query={query} />

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
