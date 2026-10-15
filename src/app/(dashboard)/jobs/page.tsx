import { requireAnyPermission } from "@/lib/auth/current-user";
import { hasPermission, JOBS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageEmpty } from "@/components/shared/page-state";
import { getJobs } from "@/features/jobs/lib/get-jobs";
import { getTechnicianOptions } from "@/features/jobs/lib/get-technician-options";
import { parseJobsQuery } from "@/features/jobs/schemas/jobs-query.schema";
import { JobsFilters } from "@/features/jobs/components/jobs-filters";
import { JobsPagination } from "@/features/jobs/components/jobs-pagination";
import { JobsTable } from "@/features/jobs/components/jobs-table";

interface JobsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second guard alongside the layout's — same defense-in-depth
 * precedent as the other list routes. RLS scopes the rows: admin/ops see
 * every job, a technician only their own.
 */
export default async function JobsPage({ searchParams }: JobsPageProps) {
  const user = await requireAnyPermission(JOBS_ACCESS_PERMISSIONS);
  const canFilterByTechnician = hasPermission(user.role, "technicians:manage");

  const { query: parsed, search_error } = parseJobsQuery(await searchParams);
  // A technician only ever sees their own jobs; the filter does not apply.
  const query = canFilterByTechnician
    ? parsed
    : { ...parsed, technician_id: undefined };

  const [{ jobs, total }, technicians] = await Promise.all([
    getJobs(query),
    canFilterByTechnician ? getTechnicianOptions() : Promise.resolve(null),
  ]);

  const hasFilters = Boolean(query.q || query.status || query.technician_id);
  const emptyMessage = hasFilters
    ? "No jobs match the search or filters."
    : canFilterByTechnician
      ? "No jobs yet."
      : "No jobs are assigned to you yet.";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Jobs
      </h1>

      <JobsFilters query={query} technicians={technicians} />

      {search_error && (
        <Alert variant="destructive">
          <AlertTitle>Search not applied</AlertTitle>
          <AlertDescription>{search_error}</AlertDescription>
        </Alert>
      )}

      {total === 0 ? (
        <PageEmpty message={emptyMessage} />
      ) : (
        <>
          <JobsTable jobs={jobs} query={query} />
          <JobsPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
