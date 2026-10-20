import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";
import type { Database } from "@/types/database.types";
import {
  getMetricsForRole,
  type DashboardMetric,
} from "@/features/dashboard/lib/dashboard-metrics";

export interface DashboardMetricResult {
  metric: DashboardMetric;
  /** `null` when the count could not be read: shown as unavailable, never as 0. */
  value: number | null;
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
 * tile instead of failing the page.
 */
export async function getDashboardMetrics(
  role: Role,
  supabase?: SupabaseClient<Database>,
): Promise<DashboardMetricResult[]> {
  const client = supabase ?? (await createClient());

  return Promise.all(
    getMetricsForRole(role).map(async (metric) => ({
      metric,
      value: await countMetric(client, metric).catch(() => null),
    })),
  );
}
