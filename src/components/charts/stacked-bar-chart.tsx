"use client"

import { useId } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from "recharts"

import { ChartContainer } from "@/components/charts/chart-container"
import { ChartFrame } from "@/components/charts/chart-frame"
import { CHART_TOOLTIP_CURSOR, CHART_TOOLTIP_STYLE, formatTooltipValue } from "@/components/charts/chart-tooltip"
import { ChartPatternDefs, patternFill, patternId } from "@/components/charts/chart-patterns"
import { WrappedTick } from "@/components/charts/wrapped-tick"
import {
  barChartHeight,
  describeStacks,
  labelColumnWidth,
  maxLabelLines,
  needsScroll,
  segmentKey,
  toStackRows,
} from "@/lib/charts/bar-data"
import { abbreviateNumber, formatFullNumber, type ChartSeries, type ChartStatus } from "@/lib/charts/chart-data"
import { CHART_GRID_COLOR } from "@/lib/charts/chart-tokens"
import { cn } from "@/lib/utils"

interface StackedBarChartProps {
  title: string
  description?: string
  status: ChartStatus
  /** One series for each segment of a bar (for example a severity); its points are the categories. */
  series: readonly ChartSeries[]
  on_retry?: () => void
  gap_note?: string
  className?: string
}

/** A segment narrower than this has no room for its value; the tooltip and the table have it. */
const MIN_SEGMENT_LABEL_WIDTH = 20

interface SegmentLabelProps {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: unknown
}

/** The value of a segment, written in it, with an outline of the surface so it reads over a pattern. */
function SegmentLabel({ x = 0, y = 0, width = 0, height = 0, value }: SegmentLabelProps) {
  const w = Number(width)
  if (typeof value !== "number" || value <= 0 || w < MIN_SEGMENT_LABEL_WIDTH) return null

  return (
    <text
      x={Number(x) + w / 2}
      y={Number(y) + Number(height) / 2}
      textAnchor="middle"
      dominantBaseline="central"
      strokeWidth={3}
      className="fill-foreground stroke-card text-xs [paint-order:stroke]"
    >
      {abbreviateNumber(value)}
    </text>
  )
}

/**
 * Segments of a bar, each with its value, and the total of the bar at its end (spec R1). Segments next to
 * each other differ by a pattern as well as by color (R7). The full numbers are in the tooltip and the table.
 */
function StackedBarChart({ title, description, status, series, on_retry, gap_note, className }: StackedBarChartProps) {
  const id = patternId(useId())
  const rows = toStackRows(series)
  const labels = rows.map((row) => row.label)
  const height = barChartHeight(rows.length, maxLabelLines(labels))

  return (
    <ChartFrame title={title} description={description} status={status} series={series} on_retry={on_retry} gap_note={gap_note} legend_style="pattern" label_heading="Name" className={className}>
      <div data-slot="bar-chart-scroll" className={cn("min-w-0", needsScroll(height) && "max-h-96 overflow-y-auto")}>
        <ChartContainer label={describeStacks(title, series)} height={height}>
          <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 0, bottom: 4, left: 0 }} accessibilityLayer>
            <ChartPatternDefs id={id} count={series.length} />
            <CartesianGrid horizontal={false} stroke={CHART_GRID_COLOR} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={labelColumnWidth(labels)} tickLine={false} axisLine={false} interval={0} tick={<WrappedTick />} />
            <Tooltip cursor={CHART_TOOLTIP_CURSOR} contentStyle={CHART_TOOLTIP_STYLE} formatter={formatTooltipValue} />
            {/* The total of each bar, in a column at the right, in the order of the rows. */}
            <YAxis
              yAxisId="total"
              orientation="right"
              type="category"
              dataKey="label"
              width={48}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickFormatter={(_, index) => formatFullNumber(rows[index]?.total ?? null)}
              tick={{ className: "fill-foreground text-xs font-medium" }}
            />
            {series.map((s, index) => (
              <Bar key={s.name} dataKey={segmentKey(index)} name={s.name} stackId="stack" fill={patternFill(id, index)} maxBarSize={28} isAnimationActive={false}>
                <LabelList dataKey={segmentKey(index)} position="center" content={(props) => <SegmentLabel {...(props as SegmentLabelProps)} />} />
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </div>
    </ChartFrame>
  )
}

export { StackedBarChart }
export type { StackedBarChartProps }
