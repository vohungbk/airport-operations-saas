import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { hasPermission, JOBS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { PageEmpty } from "@/components/shared/page-state";
import { getJobs } from "@/features/jobs/lib/get-jobs";
import { getJobAirportOptions, getJobsTimeZone } from "@/features/jobs/lib/get-job-airport-options";
import { getTechnicianOptions } from "@/features/jobs/lib/get-technician-options";
import { parseJobsQuery } from "@/features/jobs/schemas/jobs-query.schema";
import { JobsDeadlineChips } from "@/features/jobs/components/jobs-deadline-chips";
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
  const canManageJobs = hasPermission(user.role, "technicians:manage");

  const { query: parsed, search_error } = parseJobsQuery(await searchParams);
  // A technician only ever sees their own jobs; the filter does not apply.
  const query = canManageJobs
    ? parsed
    : { ...parsed, technician_id: undefined };

  const [airports, technicians] = await Promise.all([
    getJobAirportOptions(),
    canManageJobs ? getTechnicianOptions() : Promise.resolve(null),
  ]);
  const timeZone = getJobsTimeZone(airports, query.airport_id);
  const { jobs, total } = await getJobs(query, new Date(), timeZone);

  const clearHref = `/jobs?sort=${query.sort}&order=${query.order}`;
  const hasFilters = Boolean(
    query.q ||
      query.status ||
      query.type ||
      query.technician_id ||
      query.airport_id ||
      query.deadline ||
      query.unassigned ||
      query.from ||
      query.to,
  );
  const emptyMessage = hasFilters
    ? "No jobs match the search or filters."
    : canManageJobs
      ? "No jobs yet."
      : "No jobs are assigned to you yet.";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl leading-8 font-semibold text-primary-subtle-foreground">
            Jobs
          </h1>
          {canManageJobs && (
            <Link
              href="/jobs/new"
              className={buttonVariants({ className: "min-h-11 px-4" })}
            >
              <PlusIcon aria-hidden="true" />
              Create job
            </Link>
          )}
        </div>
        <p className="text-sm leading-5 text-text-muted">
          {total} job{total === 1 ? "" : "s"}
        </p>
      </div>

      <JobsFilters
        // The search box keeps what was typed; a new search starts it again from the address.
        key={query.q ?? ""}
        query={query}
        technicians={technicians}
        airports={airports}
        timeZone={timeZone}
        clearHref={clearHref}
      />

      <JobsDeadlineChips query={query} />

      {search_error && (
        <Alert variant="destructive">
          <AlertTitle>Search not applied</AlertTitle>
          <AlertDescription>{search_error}</AlertDescription>
        </Alert>
      )}

      {total === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
          <PageEmpty message={emptyMessage} />
          {hasFilters && (
            <Link
              href={clearHref}
              className={buttonVariants({ variant: "outline", className: "min-h-11 rounded-lg bg-surface px-4" })}
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <JobsTable jobs={jobs} />
          <div className="border-t border-border">
            <JobsPagination query={query} total={total} />
          </div>
        </div>
      )}
    </div>
  );
}
