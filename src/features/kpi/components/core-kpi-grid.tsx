import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import type { CoreKpiTile } from "@/features/kpi/lib/core-kpi-tiles";

interface CoreKpiGridProps {
  tiles: readonly CoreKpiTile[];
}

/** The five core KPIs as the design draws them (VI-F05-S01, R1): a label, the value, and one line under it. */
export function CoreKpiGrid({ tiles }: CoreKpiGridProps) {
  return (
    <section aria-labelledby="core-kpis-heading" className="flex flex-col gap-3">
      <h2 id="core-kpis-heading" className="text-xl font-semibold text-foreground">
        Core programme KPIs
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <OverviewTile
            key={tile.id}
            label={tile.label}
            value={tile.value}
            caption={tile.caption}
            className="min-h-[126px] rounded-lg"
          />
        ))}
      </div>
    </section>
  );
}
