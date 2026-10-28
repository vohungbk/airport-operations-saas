import { PageEmpty } from "@/components/shared/page-state";
import { BarsCard } from "@/features/dashboard/components/chart-cards";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardRetryButton } from "@/features/dashboard/components/dashboard-retry-button";
import type { BarItem } from "@/lib/charts/bar-data";

interface StockByCategoryProps {
  /** `null` when the counts could not be read. */
  items: readonly BarItem[] | null;
}

const TITLE = "Stock by category";

/** The seats of each category. A failed read says Unavailable with a retry; no seats says so. */
export function StockByCategory({ items }: StockByCategoryProps) {
  if (items === null || items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {TITLE}
          </h3>
          {items === null ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">
                Unavailable. The counts for this chart could not be read.
              </p>
              <DashboardRetryButton />
            </div>
          ) : (
            <PageEmpty message="No seat categories yet." />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <BarsCard
      title={TITLE}
      rows={items.map((item) => ({
        label: item.label,
        value: item.value ?? 0,
      }))}
    />
  );
}
