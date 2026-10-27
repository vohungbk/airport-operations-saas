"use client"

import { ArrowDownIcon, ArrowUpIcon, BanIcon, ChartNoAxesColumnIcon, CircleAlertIcon, MinusIcon, RotateCcwIcon } from "lucide-react"

import { Sparkline } from "@/components/charts/sparkline"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ChartPoint, ChartStatus } from "@/lib/charts/chart-data"
import { DEFAULT_PERIOD_LABELS, changeWords, kpiComparison, kpiTileState, type KpiPeriodLabels } from "@/lib/charts/kpi-data"
import type { ChangeDirection } from "@/lib/assistant/answer"
import { cn } from "@/lib/utils"

interface KpiComparisonTileProps {
  label: string
  /** How the read went. The screen decides this from its own checks; the tile only shows it. */
  status: ChartStatus
  /** The figure of this period; `null` when it could not be read. It is shown as it is, never changed. */
  current: number | null
  /** The figure of the period before; `null` when there is none. */
  previous: number | null
  period_labels?: KpiPeriodLabels
  /** The last few periods for the small trend line; fewer than two values draw nothing. */
  trend?: readonly ChartPoint[]
  on_retry?: () => void
  className?: string
}

/** The retry of a tile whose screen gave no handler: read the page again, which runs the data call again. */
const reloadPage = () => window.location.reload()

const CHANGE_ICON: Record<ChangeDirection, typeof ArrowUpIcon> = {
  up: ArrowUpIcon,
  down: ArrowDownIcon,
  flat: MinusIcon,
  unknown: MinusIcon,
}

/**
 * This period against the one before, with the change as an arrow and words, and a small trend line
 * (UI-F05-S04, spec R4). The figure is shown as it was given (R9): shortened on the tile, whole in the
 * title and for a screen reader. A tile with no figure says so; it does not show 0.
 */
function KpiComparisonTile({ label, status, current, previous, period_labels = DEFAULT_PERIOD_LABELS, trend, on_retry, className }: KpiComparisonTileProps) {
  const state = kpiTileState(status, current)

  return (
    <Card data-slot="kpi-tile" data-state={state} aria-busy={state === "loading" || undefined} className={cn("min-w-0", className)}>
      <CardContent className="flex min-w-0 flex-col gap-2">
        <p className="min-w-0 break-words text-sm text-muted-foreground">
          {label}
          {state === "ready" && <span data-slot="kpi-period"> · {period_labels.current}</span>}
        </p>

        {state === "loading" && (
          <div data-slot="kpi-loading" role="status" className="flex flex-col gap-2">
            <span className="sr-only">Loading {label}</span>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}

        {state === "error" && (
          <div data-slot="kpi-error" className="flex flex-col items-start gap-2 text-sm">
            <p role="alert" className="flex items-center gap-1.5">
              <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
              This figure could not be loaded.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={on_retry ?? reloadPage}>
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}

        {state === "forbidden" && (
          <p data-slot="kpi-forbidden" className="flex items-center gap-1.5 text-sm">
            <BanIcon className="size-4 shrink-0" aria-hidden="true" />
            You do not have access to this figure.
          </p>
        )}

        {state === "empty" && (
          <p data-slot="kpi-empty" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ChartNoAxesColumnIcon className="size-4 shrink-0" aria-hidden="true" />
            No data yet.
          </p>
        )}

        {state === "ready" && current !== null && <Figures current={current} previous={previous} labels={period_labels} trend={trend} label={label} />}
      </CardContent>
    </Card>
  )
}

interface FiguresProps {
  label: string
  current: number
  previous: number | null
  labels: KpiPeriodLabels
  trend?: readonly ChartPoint[]
}

function Figures({ label, current, previous, labels, trend }: FiguresProps) {
  const { current_short, current_full, previous_full, change } = kpiComparison(current, previous)
  const Icon = CHANGE_ICON[change.direction]

  return (
    <>
      <p className="min-w-0 break-words text-3xl font-semibold tabular-nums tracking-tight">
        <span aria-hidden="true" title={current_full} data-slot="kpi-figure">
          {current_short}
        </span>
        <span className="sr-only">{current_full}</span>
      </p>
      <p data-slot="kpi-change" data-direction={change.direction} className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm font-medium tabular-nums">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {changeWords(change)}
      </p>
      <p data-slot="kpi-previous" className="text-xs tabular-nums text-muted-foreground">
        {labels.previous} {previous_full ?? "no data"}
      </p>
      {trend && <Sparkline label={label} points={trend} />}
    </>
  )
}

export { KpiComparisonTile }
export type { KpiComparisonTileProps }
