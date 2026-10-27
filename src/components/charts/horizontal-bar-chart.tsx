"use client"

import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from "recharts"

import { ChartContainer } from "@/components/charts/chart-container"
import { ChartFrame } from "@/components/charts/chart-frame"
import { CHART_TOOLTIP_CURSOR, CHART_TOOLTIP_STYLE, formatTooltipValue } from "@/components/charts/chart-tooltip"
import { WrappedTick } from "@/components/charts/wrapped-tick"
import {
  barChartHeight,
  describeBars,
  labelColumnWidth,
  maxLabelLines,
  needsScroll,
  toBarSeries,
  type BarItem,
} from "@/lib/charts/bar-data"
import { abbreviateNumber, type ChartStatus } from "@/lib/charts/chart-data"
import { CHART_GRID_COLOR, seriesColor } from "@/lib/charts/chart-tokens"
import { cn } from "@/lib/utils"

interface HorizontalBarChartProps {
  title: string
  description?: string
  status: ChartStatus
  /** One bar for each item, in the order given. */
  items: readonly BarItem[]
  /** What the bars count, shown in the legend and as the column of the table view. */
  series_name?: string
  on_retry?: () => void
  gap_note?: string
  className?: string
}

/**
 * A bar for each category, with its name at the left and its value at the end of the bar (spec R1).
 * The full number is in the tooltip and in the table view. A long name wraps, and a chart with many
 * categories grows and scrolls inside its own box, so the page never scrolls sideways (E2).
 */
function HorizontalBarChart({ title, description, status, items, series_name, on_retry, gap_note, className }: HorizontalBarChartProps) {
  const labels = items.map((item) => item.label)
  const height = barChartHeight(items.length, maxLabelLines(labels))

  return (
    <ChartFrame
      title={title}
      description={description}
      status={status}
      series={toBarSeries(items, series_name ?? "Count")}
      on_retry={on_retry}
      gap_note={gap_note}
      label_heading="Name"
      className={className}
    >
      <div data-slot="bar-chart-scroll" className={cn("min-w-0", needsScroll(height) && "max-h-96 overflow-y-auto")}>
        <ChartContainer label={describeBars(title, items)} height={height}>
          <BarChart layout="vertical" data={[...items]} margin={{ top: 4, right: 48, bottom: 4, left: 0 }} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke={CHART_GRID_COLOR} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={labelColumnWidth(labels)} tickLine={false} axisLine={false} interval={0} tick={<WrappedTick />} />
            <Tooltip cursor={CHART_TOOLTIP_CURSOR} contentStyle={CHART_TOOLTIP_STYLE} formatter={formatTooltipValue} />
            <Bar dataKey="value" name={series_name ?? "Count"} fill={seriesColor(0)} radius={4} maxBarSize={28} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" className="fill-foreground text-xs" formatter={(value) => (typeof value === "number" ? abbreviateNumber(value) : "")} />
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </ChartFrame>
  )
}

export { HorizontalBarChart }
export type { HorizontalBarChartProps }
