import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";
import type { Database } from "@/types/database.types";
import {
  getChartsForRole,
  type ChartCategory,
  type DashboardChartDef,
} from "@/features/dashboard/lib/dashboard-charts";
import {
  DASHBOARD_MODULE_RELEASED,
  type DashboardModule,
} from "@/features/dashboard/lib/dashboard-metrics";
import { countMetric } from "@/features/dashboard/lib/get-dashboard-metrics";

export interface ChartBarResult {
  category: ChartCategory;
  /** `null` when the count could not be read. Never a made-up 0. */
  value: number | null;
}

export interface DashboardChartResult {
  chart: DashboardChartDef;
  bars: ChartBarResult[];
}

/**
 * Server-only. The counts behind each chart the role may see, one count query per
 * bar, run side by side in the scope of the viewer's RLS (admin and operations
 * counts everything, a technician their jobs and incidents, a partner user their
 * partner's bookings and incidents). A bar whose count fails is `null`; it never
 * fails the page. A module that is not released has no chart: its cards already say
 * Not available yet, and no query is made for it.
 */
export async function getDashboardCharts(
  role: Role,
  supabase?: SupabaseClient<Database>,
  released: Readonly<Record<DashboardModule, boolean>> = DASHBOARD_MODULE_RELEASED,
): Promise<DashboardChartResult[]> {
  const charts = getChartsForRole(role).filter((chart) => released[chart.module]);
  if (charts.length === 0) return [];

  const client = supabase ?? (await createClient());

  return Promise.all(
    charts.map(async (chart): Promise<DashboardChartResult> => ({
      chart,
      bars: await Promise.all(
        chart.categories.map(
          async (category): Promise<ChartBarResult> => ({
            category,
            value: await countMetric(client, { source: chart.source, filters: category.filters }).catch(
              () => null,
            ),
          }),
        ),
      ),
    })),
  );
}
