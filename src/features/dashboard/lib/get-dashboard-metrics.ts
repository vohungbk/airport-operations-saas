import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";
import type { Database } from "@/types/database.types";
import {
  DASHBOARD_MODULE_RELEASED,
  getMetricsForRole,
  type DashboardMetric,
  type DashboardModule,
} from "@/features/dashboard/lib/dashboard-metrics";

export interface DashboardMetricResult {
  metric: DashboardMetric;
  /**
   * `null` when there is no count to show: it could not be read, or the module
   * is not released. Never a made-up 0.
   */
  value: number | null;
  /** Why there is no count, when it is not a failed read. */
  reason?: "not_released";
}

/**
 * One count query for one metric, in the scope of the client's user.
 * `head: true` returns the count without the rows.
 */
export async function countMetric(
  supabase: SupabaseClient<Database>,
  metric: DashboardMetric,
): Promise<number | null> {
  let query = supabase
    .from(metric.source)
    .select("id", { count: "exact", head: true });

  for (const [column, value] of Object.entries(metric.filters)) {
    query = query.eq(column as never, value as never);
  }

  const { count, error } = await query;

  return error || count === null ? null : count;
}

/**
 * Server-only. RLS is the scope: admin/ops count every row, a technician their
 * jobs and incidents, a partner user their partner's bookings and incidents.
 * The queries run side by side, and one that fails leaves a gap in its own
 * tile instead of failing the page. A figure of a module that is not released
 * makes no query at all.
 */
export async function getDashboardMetrics(
  role: Role,
  supabase?: SupabaseClient<Database>,
  released: Readonly<Record<DashboardModule, boolean>> = DASHBOARD_MODULE_RELEASED,
): Promise<DashboardMetricResult[]> {
  const client = supabase ?? (await createClient());

  return Promise.all(
    getMetricsForRole(role).map(
      async (metric): Promise<DashboardMetricResult> => {
        if (!released[metric.module]) {
          return { metric, value: null, reason: "not_released" };
        }

        return {
          metric,
          value: await countMetric(client, metric).catch(() => null),
        };
      },
    ),
  );
}
