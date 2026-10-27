"use client"

import { cloneElement } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ResponsiveContainer } from "recharts"

import { cn } from "@/lib/utils"

/*
 * The one place a screen's chart meets the chart library (UI-F05-S01, spec R6, R11). It takes the
 * width of its parent (`w-full min-w-0`) and never sets a width of its own, so a chart reflows
 * with the screen and does not push the page sideways at 390 px. The height is one of four sizes, or
 * a number of pixels when the chart grows with its data.
 */
const chartContainerVariants = cva("w-full min-w-0 overflow-hidden", {
  variants: {
    size: {
      /** A line in a tile (a sparkline). */
      xs: "h-10",
      sm: "h-40",
      md: "h-60",
      lg: "h-80",
      /** The height comes from `height`, in pixels, through a custom property. */
      custom: "h-(--chart-height)",
    },
  },
  defaultVariants: { size: "md" },
})

interface ChartContainerProps extends Omit<VariantProps<typeof chartContainerVariants>, "size"> {
  size?: "xs" | "sm" | "md" | "lg"
  /** A height in pixels, for a chart whose size follows its data (a bar for each category). It replaces `size`. */
  height?: number
  /** What the chart shows, with its values, read by a screen reader; the table view has the numbers too. */
  label: string
  /** The short name of the chart: it is the name of the drawing a keyboard user lands on (spec E5). Defaults to `label`. */
  name?: string
  /** A chart of the library, drawn at the size of the container. */
  children: React.ReactElement
  className?: string
}

/**
 * The drawing of the library is focusable (`accessibilityLayer`: Tab to it, arrow keys move between
 * the values, which are read out) but has no name of its own, so it is given one. It sits in a group, not
 * in `role="img"`: an image has presentational children, and a focusable drawing inside one is read
 * without a name or a role.
 */
export function withChartName(chart: React.ReactElement, name: string): React.ReactElement {
  return cloneElement(chart as React.ReactElement<{ title?: string }>, { title: name })
}

function ChartContainer({ label, name, size, height, children, className }: ChartContainerProps) {
  return (
    <div
      data-slot="chart-container"
      role="group"
      aria-label={label}
      className={cn(chartContainerVariants({ size: height === undefined ? size : "custom" }), className)}
      style={height === undefined ? undefined : ({ "--chart-height": `${height}px` } as React.CSSProperties)}
    >
      {/* The first size is what the server draws, so the chart does not jump when it measures itself. */}
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}>
        {withChartName(children, name ?? label)}
      </ResponsiveContainer>
    </div>
  )
}

export { ChartContainer, chartContainerVariants }
export type { ChartContainerProps }
