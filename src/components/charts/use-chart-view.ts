"use client"

import { useState } from "react"

export type ChartView = "chart" | "table"

/** Which of the two views of the same numbers a chart shows (spec R5, NAV-1). It starts on the chart. */
export function useChartView(initial: ChartView = "chart") {
  const [view, setView] = useState<ChartView>(initial)
  const toggle = () => setView((current) => (current === "chart" ? "table" : "chart"))

  return { view, toggle }
}
