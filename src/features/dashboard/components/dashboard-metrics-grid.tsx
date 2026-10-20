import { MetricTile } from "@/features/dashboard/components/metric-tile";
import {
  DASHBOARD_MODULE_LABEL,
  type DashboardModule,
} from "@/features/dashboard/lib/dashboard-metrics";
import type { DashboardMetricResult } from "@/features/dashboard/lib/get-dashboard-metrics";

interface DashboardMetricsGridProps {
  results: readonly DashboardMetricResult[];
}

const MODULE_ORDER: readonly DashboardModule[] = [
  "inventory",
  "bookings",
  "jobs",
  "incidents",
];

/** Tiles grouped by module; a module the role cannot open has no section. */
export function DashboardMetricsGrid({ results }: DashboardMetricsGridProps) {
  return (
    <div className="flex flex-col gap-6">
      {MODULE_ORDER.map((module) => {
        const inModule = results.filter(
          (result) => result.metric.module === module,
        );

        if (inModule.length === 0) {
          return null;
        }

        return (
          <section
            key={module}
            aria-labelledby={`dashboard-${module}`}
            className="flex flex-col gap-3"
          >
            <h2
              id={`dashboard-${module}`}
              className="text-lg font-medium text-foreground"
            >
              {DASHBOARD_MODULE_LABEL[module]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {inModule.map(({ metric, value }) => (
                <MetricTile key={metric.id} metric={metric} value={value} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
