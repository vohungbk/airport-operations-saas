"use client"

import { CartesianGrid, LabelList, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts"

import { ChartContainer } from "@/components/charts/chart-container"
import { ChartFrame } from "@/components/charts/chart-frame"
import { ChartMarker } from "@/components/charts/chart-markers"
import { CHART_TOOLTIP_CURSOR, CHART_TOOLTIP_STYLE, formatTooltipValue } from "@/components/charts/chart-tooltip"
import { segmentKey, toStackRows } from "@/lib/charts/bar-data"
import { abbreviateNumber, type ChartSeries, type ChartStatus } from "@/lib/charts/chart-data"
import { CHART_GRID_COLOR, seriesColor, seriesMarker } from "@/lib/charts/chart-tokens"
import { describeLines, labelsPoint, writesPointValues } from "@/lib/charts/line-data"

interface LineTrendChartProps {
  title: string
  description?: string
  status: ChartStatus
  /** One line for each series; its points are the months (or other periods), in order. */
  series: readonly ChartSeries[]
  on_retry?: () => void
  gap_note?: string
  /** The heading of the first column of the table view. */
  label_heading?: string
  className?: string
}

const AXIS_TICK = { className: "fill-muted-foreground text-xs" }

interface PointProps {
  cx?: number
  cy?: number
  index?: number
  payload?: Record<string, unknown>
}

interface PointLabelProps {
  x?: number | string
  y?: number | string
  value?: unknown
  index?: number
}

/**
 * A value for each month as a line, with a marker on each point and its value above it (spec R3).
 * Lines differ by marker shape as well as color (R7). A missing month breaks the line instead of
 * being joined across. Values are shortened; the tooltip and the table have the full numbers (E3).
 * A line alone has its values written on its points; several lines would write over each other, so
 * they have the tooltip, the legend and the table.
 */
function LineTrendChart({ title, description, status, series, on_retry, gap_note, label_heading = "Period", className }: LineTrendChartProps) {
  const rows = toStackRows(series)
  const count = rows.length

  return (
    <ChartFrame title={title} description={description} status={status} series={series} on_retry={on_retry} gap_note={gap_note} legend_style="marker" label_heading={label_heading} className={className}>
      <ChartContainer label={describeLines(title, series)} name={title} size="md">
        <LineChart data={rows} margin={{ top: 20, right: 16, bottom: 4, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" padding={{ left: 20, right: 20 }} tick={AXIS_TICK} />
          <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={abbreviateNumber} tick={AXIS_TICK} />
          <Tooltip cursor={CHART_TOOLTIP_CURSOR} contentStyle={CHART_TOOLTIP_STYLE} formatter={formatTooltipValue} />
          {series.map((s, index) => (
            <Line
              key={s.name}
              dataKey={segmentKey(index)}
              name={s.name}
              type="linear"
              stroke={seriesColor(index)}
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
              dot={({ cx, cy, index: at, payload }: PointProps) =>
                typeof payload?.[segmentKey(index)] === "number" ? (
                  <ChartMarker key={at} marker={seriesMarker(index)} x={cx} y={cy} color={seriesColor(index)} />
                ) : (
                  // A missing month has no point: nothing is drawn where it would be.
                  <g key={at} />
                )
              }
              activeDot={false}
            >
              {writesPointValues(series.length) && (
                <LabelList
                  dataKey={segmentKey(index)}
                  content={({ x = 0, y = 0, value, index: at = 0 }: PointLabelProps) =>
                    typeof value === "number" && labelsPoint(at, count) ? (
                      <text x={Number(x)} y={Number(y) - 10} textAnchor="middle" strokeWidth={3} className="fill-foreground stroke-card text-xs [paint-order:stroke]">
                        {abbreviateNumber(value)}
                      </text>
                    ) : null
                  }
                />
              )}
            </Line>
          ))}
        </LineChart>
      </ChartContainer>
    </ChartFrame>
  )
}

export { LineTrendChart }
export type { LineTrendChartProps }
