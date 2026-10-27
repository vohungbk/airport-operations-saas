import { formatFullNumber } from "@/lib/charts/chart-data"
import { CHART_GRID_COLOR } from "@/lib/charts/chart-tokens"

/** How the tooltip of a chart looks: the surface and border tokens, so it follows the theme. */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  color: "var(--card-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: "0.75rem",
}

/** The bar a pointer is over is marked in the grid color. */
export const CHART_TOOLTIP_CURSOR = { fill: CHART_GRID_COLOR, fillOpacity: 0.4 }

/** The tooltip gives the full number, where the chart shows it shortened. */
export const formatTooltipValue = (value: unknown) => formatFullNumber(typeof value === "number" ? value : null)
