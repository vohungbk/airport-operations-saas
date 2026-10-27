import { CHART_GRID_COLOR, seriesColor, seriesPattern, type SeriesPattern } from "@/lib/charts/chart-tokens"

const TILE = 8

/** The marks drawn over the color of a series, in the grid color (light in Light, dark in Dark) so they cut into the fill. */
const MARKS: Record<Exclude<SeriesPattern, "solid">, React.ReactNode> = {
  diagonal: <line x1={0} y1={TILE} x2={TILE} y2={0} stroke={CHART_GRID_COLOR} strokeWidth={2} />,
  dots: <circle cx={TILE / 2} cy={TILE / 2} r={1.5} fill={CHART_GRID_COLOR} />,
  cross: (
    <>
      <line x1={0} y1={0} x2={TILE} y2={TILE} stroke={CHART_GRID_COLOR} strokeWidth={1.5} />
      <line x1={TILE} y1={0} x2={0} y2={TILE} stroke={CHART_GRID_COLOR} strokeWidth={1.5} />
    </>
  ),
  vertical: <line x1={TILE / 2} y1={0} x2={TILE / 2} y2={TILE} stroke={CHART_GRID_COLOR} strokeWidth={2} />,
  horizontal: <line x1={0} y1={TILE / 2} x2={TILE} y2={TILE / 2} stroke={CHART_GRID_COLOR} strokeWidth={2} />,
}

/** An id that is safe in `url(#...)`; `useId` gives colons, which a url does not take. */
export const patternId = (rawId: string) => rawId.replace(/[^a-zA-Z0-9_-]/g, "")

/** What fills the marks of series `index`: its color for a solid series, a pattern of it otherwise (spec R7). */
export function patternFill(id: string, index: number): string {
  return seriesPattern(index) === "solid" ? seriesColor(index) : `url(#${id}-${index})`
}

interface ChartPatternDefsProps {
  /** Made with `patternId(useId())`, so two charts on a page do not share patterns. */
  id: string
  count: number
}

/** The patterns that tell neighbouring series apart by more than color. Put inside the chart. */
function ChartPatternDefs({ id, count }: ChartPatternDefsProps) {
  return <defs>{Array.from({ length: count }, (_, index) => patternTile(id, index))}</defs>
}

function patternTile(id: string, index: number) {
  const pattern = seriesPattern(index)
  if (pattern === "solid") return null
  return (
    <pattern key={index} id={`${id}-${index}`} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
      <rect width={TILE} height={TILE} fill={seriesColor(index)} />
      {MARKS[pattern]}
    </pattern>
  )
}

/** The key of a legend: the color of series `index` with its pattern, as the marks of the chart have it. */
function SeriesSwatch({ id, index }: { id: string; index: number }) {
  return (
    <svg aria-hidden="true" width={12} height={12} className="shrink-0 rounded-sm">
      <defs>{patternTile(id, index)}</defs>
      <rect width={12} height={12} fill={patternFill(id, index)} />
    </svg>
  )
}

export { ChartPatternDefs, SeriesSwatch }
export type { ChartPatternDefsProps }
