import { requirePermission } from "@/lib/auth/current-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageEmpty } from "@/components/shared/page-state";
import { getTechnicians } from "@/features/technicians/lib/get-technicians";
import { parseTechniciansQuery } from "@/features/technicians/schemas/technicians-query.schema";
import { TechniciansFilters } from "@/features/technicians/components/technicians-filters";
import { TechniciansPagination } from "@/features/technicians/components/technicians-pagination";
import { TechniciansTable } from "@/features/technicians/components/technicians-table";

interface TechniciansPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second `requirePermission` call alongside the layout's —
 * same defense-in-depth precedent as the other `(admin)` routes.
 */
export default async function TechniciansPage({
  searchParams,
}: TechniciansPageProps) {
  await requirePermission("technicians:manage");

  const { query, search_error } = parseTechniciansQuery(await searchParams);
  const { technicians, total } = await getTechnicians(query);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Technicians
      </h1>

      <TechniciansFilters query={query} />

      {search_error && (
        <Alert variant="destructive">
          <AlertTitle>Search not applied</AlertTitle>
          <AlertDescription>{search_error}</AlertDescription>
        </Alert>
      )}

      {total === 0 ? (
        <PageEmpty message="No technicians found. Try adjusting the search." />
      ) : (
        <>
          <TechniciansTable technicians={technicians} query={query} />
          <TechniciansPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
