"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { ResponsiveContainer } from "recharts"

import { cn } from "@/lib/utils"

/*
 * The one place a screen's chart meets the chart library (UI-F05-S01, spec R6, R11). It takes the
 * width of its parent (`w-full min-w-0`) and never sets a width of its own, so a chart reflows
 * with the screen and does not push the page sideways at 390 px. The height is one of three sizes, or
 * a number of pixels when the chart grows with its data.
 */
const chartContainerVariants = cva("w-full min-w-0 overflow-hidden", {
  variants: {
    size: {
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
  size?: "sm" | "md" | "lg"
  /** A height in pixels, for a chart whose size follows its data (a bar for each category). It replaces `size`. */
  height?: number
  /** What the chart shows, read by a screen reader; the table view has the numbers. */
  label: string
  /** A chart of the library, drawn at the size of the container. */
  children: React.ReactElement
  className?: string
}

function ChartContainer({ label, size, height, children, className }: ChartContainerProps) {
  return (
    <div
      data-slot="chart-container"
      role="img"
      aria-label={label}
      className={cn(chartContainerVariants({ size: height === undefined ? size : "custom" }), className)}
      style={height === undefined ? undefined : ({ "--chart-height": `${height}px` } as React.CSSProperties)}
    >
      {/* The first size is what the server draws, so the chart does not jump when it measures itself. */}
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export { ChartContainer, chartContainerVariants }
export type { ChartContainerProps }
