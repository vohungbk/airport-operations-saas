import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageEmpty } from "@/components/shared/page-state";
import { CorrectSeatFormulaHelpCard } from "@/features/kpi/components/correct-seat-formula-help-card";
import { KpiPeriodPicker } from "@/features/kpi/components/kpi-period-picker";
import { KpiTileGrid } from "@/features/kpi/components/kpi-tile-grid";
import { buildKpiFormulaHelps } from "@/features/kpi/lib/kpi-formula-help";
import { buildAdditionalKpiTiles } from "@/features/kpi/lib/additional-kpi-tiles";
import { buildCoreKpiTiles, isEmptyPeriod } from "@/features/kpi/lib/core-kpi-tiles";
import { buildCorrectSeatFormulaHelp } from "@/features/kpi/lib/correct-seat-formula-help";
import { getAdditionalKpis, type AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import { getCoreKpis, type CoreKpis } from "@/lib/kpi/get-core-kpis";
import { kpiPeriodOptions, previousKpiPeriod, resolveKpiPeriod } from "@/lib/kpi/kpi-period";
import { filterBySearch, parseKpiSearch } from "@/lib/kpi/kpi-search";

export const EMPTY_PERIOD_MESSAGE =
  "No completed rentals in this period. The KPIs appear here once rentals are completed.";

interface KpiDashboardProps {
  /** Who the figures are about: the name of the partner, or all partners. */
  scope_label: string;
  /** The `period` of the address, as it came; it is validated here, not trusted. */
  period?: string;
  /** The `compare` of the address: `off` turns the comparison off, anything else leaves it on. */
  compare?: string;
  /** The `q` of the address: the words the tiles are narrowed to; it is validated here, not trusted. */
  q?: string;
}

/**
 * The KPI dashboard (VI-F05-S01, S02). The access check is done by the page that renders it; the scope of the
 * figures is the RLS scope of the signed-in user. A period in the future gets its message and no figures,
 * and a failed read is thrown to the error boundary, never shown as an empty screen. The figures of the
 * period before are only for the change lines of the tiles: if they cannot be read, the tiles show no
 * change and the page still shows the figures of the period.
 */
export async function KpiDashboard({ scope_label, period, compare, q }: KpiDashboardProps) {
  const now = new Date();
  const resolved = resolveKpiPeriod(period, now);

  const selected = resolved.ok ? resolved.period.param : "current";
  const previousPeriod = resolved.ok ? previousKpiPeriod(resolved.period) : null;
  const compareOn = compare !== "off";
  const query = parseKpiSearch(q);
  const [result, additionalResult, previousResult] = resolved.ok
    ? await Promise.all([
        getCoreKpis({ from: resolved.period.from, to: resolved.period.to }),
        getAdditionalKpis({ from: resolved.period.from, to: resolved.period.to }),
        compareOn && previousPeriod ? getCoreKpis({ from: previousPeriod.from, to: previousPeriod.to }) : null,
      ])
    : [null, null, null];

  if ((result && !result.ok) || (additionalResult && !additionalResult.ok)) {
    throw new Error("Could not load the KPIs");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">KPI dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {scope_label}
          {resolved.ok ? ` · ${resolved.period.label}` : ""}
        </p>
      </div>

      <KpiPeriodPicker
        selected={selected}
        options={kpiPeriodOptions(now, selected)}
        compare_label={previousPeriod?.label ?? null}
        compare_on={compareOn}
        query={query}
      />

      {!resolved.ok && (
        <Alert variant="destructive">
          <AlertTitle>That period cannot be shown</AlertTitle>
          <AlertDescription>{resolved.message}</AlertDescription>
        </Alert>
      )}

      {result?.ok && additionalResult?.ok && resolved.ok && (
        <KpiFigures
          kpis={result.kpis}
          additional={additionalResult.kpis}
          previous={previousResult?.ok ? previousResult.kpis : null}
          period_label={resolved.period.label}
          query={query}
        />
      )}
    </div>
  );
}

interface KpiFiguresProps {
  kpis: CoreKpis;
  additional: AdditionalKpis;
  previous: CoreKpis | null;
  period_label: string;
  query: string;
}

/** The tiles the search leaves in each group, and the formula of Correct-seat fulfilment while its tile is one of them. */
function KpiFigures({ kpis, additional, previous, period_label, query }: KpiFiguresProps) {
  if (isEmptyPeriod(kpis)) return <PageEmpty message={EMPTY_PERIOD_MESSAGE} />;

  const coreTiles = filterBySearch(buildCoreKpiTiles(kpis, previous), query);
  const additionalTiles = filterBySearch(buildAdditionalKpiTiles(additional, kpis.commercial, period_label), query);
  const helps = buildKpiFormulaHelps(kpis, period_label);

  if (coreTiles.length === 0 && additionalTiles.length === 0) return <PageEmpty message={`No KPI matches "${query}".`} />;

  return (
    <>
      {coreTiles.length > 0 && <KpiTileGrid heading_id="core-kpis-heading" heading="Core programme KPIs" tiles={coreTiles} helps={helps} />}
      {coreTiles.some((tile) => tile.id === "correct_seat") && (
        <CorrectSeatFormulaHelpCard help={buildCorrectSeatFormulaHelp(kpis.correct_seat, period_label)} />
      )}
      {additionalTiles.length > 0 && (
        <KpiTileGrid
          heading_id="additional-kpis-heading"
          heading="Additional operational KPIs"
          tiles={additionalTiles}
          helps={helps}
        />
      )}
    </>
  );
}
