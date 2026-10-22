import type { CSSProperties } from "react";
import { OctagonAlert } from "lucide-react";

import { PageEmpty } from "@/components/shared/page-state";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardRetryButton } from "@/features/dashboard/components/dashboard-retry-button";
import { summarizeChart } from "@/features/dashboard/lib/dashboard-chart-data";
import type { ChartTone } from "@/features/dashboard/lib/dashboard-charts";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";
import { cn } from "@/lib/utils";

interface DashboardChartProps {
  result: DashboardChartResult;
}

const BAR_CLASS: Record<ChartTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
};

/**
 * One group of figures as horizontal bars (spec VI-F01 R7). Every bar is a row of
 * words: its label, its count and its share, so a status is never told by colour
 * alone (R8). The bar itself is drawing only and is hidden from a screen reader.
 * The bar that has to stand out (Critical) always has an icon and a heavier label, and
 * turns red only when it has something to count. The bars take the width of the card
 * and a long label wraps, so the chart never scrolls sideways (R9). A group with
 * nothing to chart says so (E6), and a group whose counts could not be read says
 * Unavailable; neither shows zeros as live data.
 */
export function DashboardChart({ result }: DashboardChartProps) {
  const { chart } = result;
  const view = summarizeChart(result);
  const headingId = `dashboard-chart-${chart.id}`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 id={headingId} className="text-sm font-medium text-foreground">
          {chart.title}
        </h3>

        {view.state === "unavailable" && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              Unavailable. The counts for this chart could not be read.
            </p>
            <DashboardRetryButton />
          </div>
        )}

        {view.state === "empty" && <PageEmpty message={chart.emptyMessage} />}

        {view.state === "ready" && (
          <ul aria-labelledby={headingId} className="flex flex-col gap-3">
            {view.rows.map((row) => (
              <li key={row.key} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      "flex min-w-0 items-center gap-1.5 text-sm",
                      row.emphasis && "font-semibold",
                      row.emphasis && row.value > 0 ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {row.emphasis && (
                      <OctagonAlert aria-hidden="true" className="size-4 shrink-0" />
                    )}
                    {row.label}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    <span className="font-semibold text-foreground">{row.value}</span>{" "}
                    <span className="text-muted-foreground">({row.percent}%)</span>
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={cn("h-full w-(--bar) rounded-full", BAR_CLASS[row.tone])}
                    style={{ "--bar": `${row.share}%` } as CSSProperties}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
