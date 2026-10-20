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
  /** The module is not released: there is no figure and no list to open. */
  notReleased?: boolean;
}

/**
 * The whole tile is a link to the list it counts, so it can be opened from the
 * keyboard. A value that could not be read says so; it is never shown as 0.
 */
export function MetricTile({ metric, value, notReleased = false }: MetricTileProps) {
  if (notReleased) {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{metric.label}</p>
          <p className="text-lg font-medium text-muted-foreground">
            Not available yet
          </p>
          <p className="text-xs text-muted-foreground">
            This part of the system is not released yet.
          </p>
        </CardContent>
      </Card>
    );
  }

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
