import { formatAmount, meterProgress } from "@/lib/money/money"
import { cn } from "@/lib/utils"

interface LaunchCreditMeterProps {
  accumulated: number
  /** The launch target; null or 0 means there is none, and the meter says so instead of a bar. */
  target: number | null
  className?: string
}

/** The bar stops at 100%; the text keeps the true figures. */
function LaunchCreditMeter({ accumulated, target, className }: LaunchCreditMeterProps) {
  const { percent, share } = meterProgress(accumulated, target)

  if (percent === null || share === null || target === null) {
    return (
      <p data-slot="launch-credit-meter-empty" className={cn("text-sm text-muted-foreground", className)}>
        No launch target is set.
      </p>
    )
  }

  const summary = `${formatAmount(accumulated).text} of ${formatAmount(target).text} (${share}%)`

  return (
    <div data-slot="launch-credit-meter" className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div
        role="progressbar"
        aria-label="Launch credit"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={summary}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div data-slot="launch-credit-meter-bar" className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm tabular-nums text-muted-foreground">{summary}</p>
    </div>
  )
}

export { LaunchCreditMeter }
export type { LaunchCreditMeterProps }
