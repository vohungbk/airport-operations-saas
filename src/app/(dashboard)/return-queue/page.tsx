import { requirePermission } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { PageEmpty } from "@/components/shared/page-state";
import { formatReportedAt } from "@/features/incidents/lib/incident-time";
import {
  getJobAirportOptions,
  getJobsTimeZone,
} from "@/features/jobs/lib/get-job-airport-options";
import { ReturnQueueFilters } from "@/features/return-queue/components/return-queue-filters";
import { ReturnQueuePagination } from "@/features/return-queue/components/return-queue-pagination";
import { ReturnQueueStepChips } from "@/features/return-queue/components/return-queue-step-chips";
import { ReturnQueueTable } from "@/features/return-queue/components/return-queue-table";
import { getReturnQueue } from "@/features/return-queue/lib/get-return-queue";
import { buildReturnQueueView } from "@/features/return-queue/lib/return-queue";
import { parseReturnQueueQuery } from "@/features/return-queue/schemas/return-queue-query.schema";

interface ReturnQueuePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second guard alongside the layout's. RLS scopes the bookings;
 * the filters here only narrow what the user may already read.
 */
export default async function ReturnQueuePage({
  searchParams,
}: ReturnQueuePageProps) {
  const user = await requirePermission("dashboards:view");
  const query = parseReturnQueueQuery(await searchParams);
  const now = new Date();

  const [airports, items] = await Promise.all([
    getJobAirportOptions(),
    getReturnQueue(query.airport_id, now),
  ]);
  const view = buildReturnQueueView(items, query);
  const airport =
    airports.find((option) => option.id === query.airport_id) ??
    (airports.length === 1 ? airports[0] : undefined);
  const timeZone = getJobsTimeZone(airports, query.airport_id);
  const hasFilters = Boolean(query.q || query.step || query.airport_id);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-8 font-semibold text-primary-subtle-foreground">
          Return queue
        </h1>
        <p className="text-sm text-foreground">
          {[`${ROLE_LABELS[user.role]} · Full access`, airport?.code]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-sm text-foreground">
          {`${view.all_count} seat${view.all_count === 1 ? "" : "s"} · Updated ${formatReportedAt(now.toISOString(), timeZone, ", ")}`}
        </p>
      </div>

      <ReturnQueueFilters
        // The search box keeps what was typed; a new search starts it again from the address.
        key={query.q ?? ""}
        query={query}
        airports={airports}
      />

      <ReturnQueueStepChips
        query={query}
        stepCounts={view.step_counts}
        allCount={view.all_count}
      />

      {view.total === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6">
          <PageEmpty
            message={
              hasFilters
                ? "No seats match the search or filters."
                : "No seats waiting."
            }
          />
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <ReturnQueueTable items={view.items} />
          <div className="border-t border-border">
            <ReturnQueuePagination query={query} total={view.total} />
          </div>
        </div>
      )}
    </div>
  );
}
