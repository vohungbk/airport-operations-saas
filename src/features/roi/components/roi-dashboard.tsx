import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageEmpty } from "@/components/shared/page-state";
import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import { EstimatedBusinessValue } from "@/features/roi/components/estimated-business-value";
import { ExportReportButton } from "@/features/kpi/components/export-report-button";
import { buildReportHref } from "@/features/kpi/lib/download-report";
import { KpiPeriodPicker } from "@/features/kpi/components/kpi-period-picker";
import { EDIT_BASELINE_LABEL } from "@/features/roi/lib/baseline-inputs";
import type { BaselineValues } from "@/features/roi/lib/baseline-inputs";
import { buildBaselineEstimate, type TrendMonthFigures } from "@/features/roi/lib/estimated-value";
import { readTrendMonths } from "@/features/roi/lib/read-trend-months";
import { VERIFIED_RESULTS_NOTE, buildVerifiedResults, isEmptyRoiPeriod } from "@/features/roi/lib/verified-results";
import { getAdditionalKpis, type AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import { getCoreKpis, type CoreKpis } from "@/lib/kpi/get-core-kpis";
import { kpiPeriodOptions, monthsInPeriod, previousKpiPeriod, resolveKpiPeriod } from "@/lib/kpi/kpi-period";
import { filterBySearch, parseKpiSearch } from "@/lib/kpi/kpi-search";
import { cn } from "@/lib/utils";

export const EMPTY_ROI_PERIOD_MESSAGE =
  "No completed rentals in this period. The verified results appear here once rentals are completed.";

interface RoiDashboardProps {
  /** Who the figures are about: the name of the partner, or all partners. */
  scope_label: string;
  /** A note on the scope for the line under the title, such as "Your partner data only". */
  scope_note?: string;
  /** The `period` of the address, as it came; it is validated here, not trusted. */
  period?: string;
  /** The `compare` of the address, as the picker carries it. */
  compare?: string;
  /** The `q` of the address: the words the cards are narrowed to; it is validated here, not trusted. */
  q?: string;
  /** Where Edit baseline inputs goes (VI-F05-S05, NAV-2). Only the partner page passes it, so the internal team has no button. */
  edit_baseline_href?: string;
  /**
   * The saved baseline of the partner (VI-F05-S06). Only the partner page passes it. Without one, the estimated
   * values say Not available and the frame stays whole (E2); the internal team has none.
   */
  baseline?: BaselineValues | null;
}

/**
 * The ROI dashboard (VI-F05-S04). The access check is done by the page that renders it; the scope of the
 * figures is the RLS scope of the signed-in user. The verified results are the KPI figures of the same
 * scope and period, so they match the KPI dashboard (E6). A period in the future gets its message and no
 * figures, and a failed read is thrown to the error boundary, never shown as an empty screen.
 */
export async function RoiDashboard({ scope_label, scope_note, period, compare, q, edit_baseline_href, baseline }: RoiDashboardProps) {
  const now = new Date();
  const resolved = resolveKpiPeriod(period, now);

  const selected = resolved.ok ? resolved.period.param : "current";
  const previousPeriod = resolved.ok ? previousKpiPeriod(resolved.period) : null;
  const query = parseKpiSearch(q);
  const [core, additional] = resolved.ok
    ? await Promise.all([
        getCoreKpis({ from: resolved.period.from, to: resolved.period.to }),
        getAdditionalKpis({ from: resolved.period.from, to: resolved.period.to }),
      ])
    : [null, null];

  const trend_months = resolved.ok && baseline ? await readTrendMonths(resolved.period) : [];

  if ((core && !core.ok) || (additional && !additional.ok)) {
    throw new Error("Could not load the ROI dashboard");
  }

  const subtitle = [scope_label, resolved.ok ? resolved.period.label : null, scope_note].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">ROI dashboard</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {resolved.ok && (
            <ExportReportButton href={buildReportHref("/api/reports/roi", { period: selected, compare_on: true, query })} />
          )}
          {edit_baseline_href && (
            <Link href={edit_baseline_href} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}>
              {EDIT_BASELINE_LABEL}
            </Link>
          )}
        </div>
      </div>

      <KpiPeriodPicker
        selected={selected}
        options={kpiPeriodOptions(now, selected)}
        compare_label={previousPeriod?.label ?? null}
        compare_on={compare !== "off"}
        query={query}
      />

      {!resolved.ok && (
        <Alert variant="destructive">
          <AlertTitle>That period cannot be shown</AlertTitle>
          <AlertDescription>{resolved.message}</AlertDescription>
        </Alert>
      )}

      {core?.ok && additional?.ok && resolved.ok && (
        <RoiFigures
          core={core.kpis}
          additional={additional.kpis}
          period_label={resolved.period.label}
          months={monthsInPeriod(resolved.period.param, now)}
          baseline={baseline}
          trend_months={trend_months}
          query={query}
        />
      )}
    </div>
  );
}

interface RoiFiguresProps {
  core: CoreKpis;
  additional: AdditionalKpis;
  period_label: string;
  months: number;
  baseline?: BaselineValues | null;
  trend_months: TrendMonthFigures[];
  query: string;
}

function RoiFigures({ core, additional, period_label, months, baseline, trend_months, query }: RoiFiguresProps) {
  if (isEmptyRoiPeriod(core)) return <PageEmpty message={EMPTY_ROI_PERIOD_MESSAGE} />;

  const verified = buildVerifiedResults(core, additional);
  const estimate = buildBaselineEstimate(baseline, core, { period_label, months, verified_revenue_text: verified.summary.value, trend_months });
  const cards = filterBySearch([verified.summary, ...estimate.cards], query);
  const rows = filterBySearch(verified.rows, query);

  if (cards.length === 0 && rows.length === 0) return <PageEmpty message={`No result matches "${query}".`} />;

  return (
    <>
      {cards.length > 0 && (
        <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <OverviewTile key={card.id} label={card.label} value={card.value} caption={card.caption} className="min-h-[126px] rounded-lg" />
          ))}
        </section>
      )}
      <div className="flex flex-col gap-6 lg:flex-row">
        {rows.length > 0 && (
          <Card className="rounded-lg lg:w-80 lg:shrink-0" role="region" aria-labelledby="verified-results-heading">
            <CardContent className="flex flex-col gap-4">
              <h2 id="verified-results-heading" className="text-base font-semibold text-foreground">
                Verified results
              </h2>
              <dl className="flex flex-col gap-4 text-sm">
                {rows.map((row) => (
                  <div key={row.id} className="flex items-start gap-3">
                    <dt className="flex-1 text-muted-foreground">{row.label}</dt>
                    <dd className="flex-1 text-right text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-muted-foreground">{VERIFIED_RESULTS_NOTE}</p>
            </CardContent>
          </Card>
        )}
        <EstimatedBusinessValue view={estimate} />
      </div>
    </>
  );
}
