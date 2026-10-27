"use client"

import { Line, LineChart, XAxis, YAxis } from "recharts"

import { ChartContainer } from "@/components/charts/chart-container"
import { ChartMarker } from "@/components/charts/chart-markers"
import type { ChartPoint } from "@/lib/charts/chart-data"
import { seriesColor } from "@/lib/charts/chart-tokens"
import { describeSparkline, lastKnownIndex, sparklineReady } from "@/lib/charts/kpi-data"

interface SparklineProps {
  /** What the trend is of, read out with its points. */
  label: string
  /** One point for each period, in order; `null` is a gap. */
  points: readonly ChartPoint[]
  className?: string
}

interface PointProps {
  cx?: number
  cy?: number
  index?: number
}

/**
 * A small trend line for a tile (spec R4): no axes and no grid, a mark on the last point. It is not
 * drawn for fewer than two values, or for values that are all 0, since that is not a trend (R10).
 * A missing period breaks the line. The tile and the table view carry the numbers.
 */
function Sparkline({ label, points, className }: SparklineProps) {
  if (!sparklineReady(points)) return null
  const last = lastKnownIndex(points)

  return (
    <ChartContainer label={describeSparkline(label, points)} name={`${label} trend`} size="xs" className={className}>
      <LineChart data={points.map((p) => ({ label: p.label, value: p.value }))} margin={{ top: 4, right: 6, bottom: 4, left: 6 }}>
        <XAxis dataKey="label" hide />
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line
          dataKey="value"
          type="linear"
          stroke={seriesColor(0)}
          strokeWidth={2}
          connectNulls={false}
          isAnimationActive={false}
          activeDot={false}
          dot={({ cx, cy, index }: PointProps) => (index === last ? <ChartMarker key={index} marker="circle" x={cx} y={cy} color={seriesColor(0)} /> : <g key={index} />)}
        />
      </LineChart>
    </ChartContainer>
  )
}

export { Sparkline }
export type { SparklineProps }
