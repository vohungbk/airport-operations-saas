import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import { KpiFormulaPopover } from "@/features/kpi/components/kpi-formula-popover";
import type { KpiFormulaHelp } from "@/features/kpi/lib/kpi-formula-help";
import type { KpiTile } from "@/features/kpi/lib/kpi-tile";

interface KpiTileGridProps {
  /** The id of the heading, so each group of tiles names itself for a screen reader. */
  heading_id: string;
  heading: string;
  tiles: readonly KpiTile[];
  /** The formula popover of each tile, by tile id; a tile with none opens nothing. */
  helps: Readonly<Record<string, KpiFormulaHelp>>;
}

/** A group of KPI tiles as the design draws them (VI-F05-S01, S02): a heading, then a label, the value, and one line under it. */
export function KpiTileGrid({ heading_id, heading, tiles, helps }: KpiTileGridProps) {
  return (
    <section aria-labelledby={heading_id} className="flex flex-col gap-3">
      <h2 id={heading_id} className="text-xl font-semibold text-foreground">
        {heading}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <OverviewTile
            key={tile.id}
            label={tile.label}
            value={tile.value}
            caption={tile.caption}
            className="min-h-[126px] rounded-lg"
            overlay={helps[tile.id] && <KpiFormulaPopover help={helps[tile.id]} label={tile.label} />}
          />
        ))}
      </div>
    </section>
  );
}
