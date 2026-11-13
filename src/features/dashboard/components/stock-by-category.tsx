import type { CSSProperties } from "react";

import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardRetryButton } from "@/features/dashboard/components/dashboard-retry-button";
import { toStockRows, type StockCategory } from "@/features/dashboard/lib/stock-rows";
import { formatDate } from "@/features/jobs/lib/job-time";

interface StockByCategoryProps {
  /** `null` when the counts could not be read. */
  items: readonly StockCategory[] | null;
  /** When the page counted its figures; written in the line under the rows. */
  loadedAt: Date;
}

/**
 * The seats available in each category (VI-F11-S06): a symbol and the name, the count, and a bar for the
 * share of the category that is available. A failed read shows an error with a retry, and no category shows
 * an empty line; neither is drawn as zeros.
 */
export function StockByCategory({ items, loadedAt }: StockByCategoryProps) {
  const rows = items ? toStockRows(items) : [];

  return (
    <Card data-slot="stock-by-category">
      <CardHeader>
        <CardTitle>Stock by category</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items === null && (
          <Alert variant="destructive" data-slot="chart-error">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>This chart could not be loaded.</AlertTitle>
            <AlertDescription>
              <DashboardRetryButton />
            </AlertDescription>
          </Alert>
        )}

        {items !== null && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No seat categories yet.</p>
        )}

        {rows.length > 0 && (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words text-foreground">
                    <span aria-hidden="true">{row.symbol} </span>
                    {row.label}
                  </span>
                  <span className="font-semibold text-foreground">{row.count}</span>
                </div>
                <div
                  role="meter"
                  aria-label={`${row.label}: ${row.count} available`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.percent}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full w-(--stock-width) rounded-full bg-(--stock-color)"
                    style={{ "--stock-width": `${row.percent}%`, "--stock-color": row.color } as CSSProperties}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {items !== null && (
          <p className="text-xs text-muted-foreground">
            Legend: symbol + status label · count · {formatDate(loadedAt, "UTC")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
