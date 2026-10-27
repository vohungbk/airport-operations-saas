"use client"

import { useId } from "react"
import { Cell, Pie, PieChart, Tooltip } from "recharts"

import { ChartContainer } from "@/components/charts/chart-container"
import { ChartFrame } from "@/components/charts/chart-frame"
import { ChartPatternDefs, patternFill, patternId } from "@/components/charts/chart-patterns"
import { CHART_TOOLTIP_STYLE, formatTooltipValue } from "@/components/charts/chart-tooltip"
import type { ChartStatus } from "@/lib/charts/chart-data"
import { centerTotal, describeSlices, donutTable, sliceDetail, toDonutSeries, toSlices, type DonutItem } from "@/lib/charts/donut-data"

interface DonutChartProps {
  title: string
  description?: string
  status: ChartStatus
  /** One slice for each item, in the order given. */
  items: readonly DonutItem[]
  /** What the slices count, shown as the column of the table view. */
  series_name?: string
  on_retry?: () => void
  gap_note?: string
  className?: string
}

/**
 * The shares of a whole as a ring, with the total in the middle and a text legend that gives each
 * slice its value and share (spec R2). Slices differ by pattern as well as color (R7). The middle
 * shows the total shortened; the full number is in the table view and read out with the chart (E3).
 */
function DonutChart({ title, description, status, items, series_name = "Count", on_retry, gap_note, className }: DonutChartProps) {
  const id = patternId(useId())
  const data = toSlices(items)
  const ring = data.slices.map((slice, index) => ({ ...slice, index })).filter((slice) => slice.value > 0)

  return (
    <ChartFrame
      title={title}
      description={description}
      status={status}
      series={toDonutSeries(items, series_name)}
      on_retry={on_retry}
      gap_note={gap_note}
      legend_items={data.slices.map((slice) => ({ name: slice.label, detail: sliceDetail(slice) }))}
      legend_style="pattern"
      table={donutTable(items, series_name)}
      className={className}
    >
      <div data-slot="donut" className="relative min-w-0">
        <ChartContainer label={describeSlices(title, data)} name={title} size="md">
          <PieChart accessibilityLayer>
            <ChartPatternDefs id={id} count={data.slices.length} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatTooltipValue} />
            <Pie data={ring} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="90%" paddingAngle={ring.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {ring.map((slice) => (
                <Cell key={slice.label} fill={patternFill(id, slice.index)} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div data-slot="donut-total" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{centerTotal(data.total)}</span>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
      </div>
    </ChartFrame>
  )
}

export { DonutChart }
export type { DonutChartProps }
