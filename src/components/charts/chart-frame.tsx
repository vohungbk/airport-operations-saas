"use client"

import { useId } from "react"

import { BanIcon, ChartNoAxesColumnIcon, CircleAlertIcon, InfoIcon, RotateCcwIcon, TableIcon } from "lucide-react"

import { ChartDataTable } from "@/components/charts/chart-data-table"
import { SeriesSwatch, patternId } from "@/components/charts/chart-patterns"
import { useChartView } from "@/components/charts/use-chart-view"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { chartFrameState, toChartTable, type ChartSeries, type ChartStatus } from "@/lib/charts/chart-data"
import { seriesColor } from "@/lib/charts/chart-tokens"
import { cn } from "@/lib/utils"

interface ChartFrameProps {
  title: string
  description?: string
  /** How the read went. The screen decides this from its own checks; the frame only shows it. */
  status: ChartStatus
  /** The numbers behind the chart. They give the legend, the table view and the empty check. */
  series: readonly ChartSeries[]
  on_retry?: () => void
  /** Said under a chart that has gaps. */
  gap_note?: string
  /** The legend shows the pattern of each series as well as its color, for charts that stack series (spec R7). */
  legend_patterns?: boolean
  /** The heading of the first column of the table view. */
  label_heading?: string
  /** The chart, drawn by a chart component inside a `ChartContainer`. */
  children: React.ReactNode
  className?: string
}

/**
 * The frame every chart sits in (UI-F05-S01, spec §5.1, R5, R7, R10, E4): title, a text legend, the
 * switch to a table of the same numbers, and the states Loading, Error with retry, Permission
 * Denied and Empty. A chart of zeros is Empty, and data with gaps carries a note.
 */
function ChartFrame({ title, description, status, series, on_retry, gap_note = "Some data is missing, so this chart may be incomplete.", legend_patterns = false, label_heading, children, className }: ChartFrameProps) {
  const state = chartFrameState(status, series)
  const { view, toggle } = useChartView()
  const swatchId = patternId(useId())
  const hasChart = state === "ready" || state === "partial"

  return (
    <Card data-slot="chart-frame" data-state={state} aria-busy={state === "loading" || undefined} className={cn("min-w-0", className)}>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <CardTitle className="min-w-0 break-words">{title}</CardTitle>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {hasChart && (
            <Button type="button" variant="outline" size="sm" onClick={toggle}>
              <TableIcon data-icon="inline-start" aria-hidden="true" />
              {view === "chart" ? "View as table" : "View as chart"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3">
        {state === "loading" && (
          <div data-slot="chart-loading" role="status" className="flex flex-col gap-2">
            <span className="sr-only">Loading the chart</span>
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {state === "error" && (
          <Alert variant="destructive" data-slot="chart-error">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>This chart could not be loaded.</AlertTitle>
            <AlertDescription>
              <Button type="button" variant="outline" size="sm" onClick={on_retry} className="mt-1">
                <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {state === "forbidden" && (
          <Alert data-slot="chart-forbidden">
            <BanIcon aria-hidden="true" />
            <AlertTitle>You do not have access to this chart.</AlertTitle>
          </Alert>
        )}

        {state === "empty" && (
          <p data-slot="chart-empty" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <ChartNoAxesColumnIcon className="size-4 shrink-0" aria-hidden="true" />
            No data to chart yet.
          </p>
        )}

        {hasChart && (
          <>
            {view === "chart" ? (
              <>
                {children}
                <ul data-slot="chart-legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {series.map((s, index) => (
                    <li key={s.name} className="flex min-w-0 items-center gap-1.5">
                      {legend_patterns ? (
                        <SeriesSwatch id={swatchId} index={index} />
                      ) : (
                        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm bg-(--swatch)" style={{ "--swatch": seriesColor(index) } as React.CSSProperties} />
                      )}
                      <span className="min-w-0 break-words">{s.name}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <ChartDataTable table={toChartTable(series, label_heading)} caption={`${title}: the numbers of the chart`} />
            )}
            {state === "partial" && (
              <p data-slot="chart-gap-note" className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {gap_note}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export { ChartFrame }
export type { ChartFrameProps }
