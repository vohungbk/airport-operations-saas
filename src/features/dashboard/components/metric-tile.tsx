import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import {
  getMetricHref,
  type DashboardMetric,
} from "@/features/dashboard/lib/dashboard-metrics";

interface MetricTileProps {
  metric: DashboardMetric;
  /** `null` when the count could not be read. */
  value: number | null;
}

/**
 * The whole tile is a link to the list it counts, so it can be opened from the
 * keyboard. A value that could not be read says so; it is never shown as 0.
 */
export function MetricTile({ metric, value }: MetricTileProps) {
  return (
    <Link
      href={getMetricHref(metric)}
      className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardContent className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{metric.label}</p>
          {value === null ? (
            <p className="text-lg font-medium text-muted-foreground">
              Unavailable
            </p>
          ) : (
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{metric.formula}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
