import { MoneyAmount } from "@/components/domain/money-amount"
import type { AdjustmentKind } from "@/lib/money/money"
import { cn } from "@/lib/utils"

export interface RevenueBreakdownLine {
  label: string
  /** The stored amount; null when it was not calculated. */
  value: number | null
  /** How it was worked out, for example "70%" or "3 paid days". */
  note?: string
  kind?: AdjustmentKind
}

interface RevenueBreakdownProps {
  lines: readonly RevenueBreakdownLine[]
  currency?: string
  emptyMessage?: string
  className?: string
}

/** Shows lines the screen built from stored figures. Nothing is calculated here. No lines is an empty state, not zeros. */
function RevenueBreakdown({
  lines,
  currency,
  emptyMessage = "No revenue yet.",
  className,
}: RevenueBreakdownProps) {
  if (lines.length === 0) {
    return (
      <p data-slot="revenue-breakdown-empty" className={cn("text-sm text-muted-foreground", className)}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <dl data-slot="revenue-breakdown" className={cn("grid min-w-0 grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm", className)}>
      {lines.map((line, index) => (
        <div key={`${index}-${line.label}`} className="col-span-2 grid grid-cols-subgrid items-baseline">
          <dt className="min-w-0 break-words text-muted-foreground">
            {line.label}
            {line.note && <span className="ml-1 text-xs">({line.note})</span>}
          </dt>
          <dd className="min-w-0 text-right">
            {line.value === null ? (
              <span className="text-muted-foreground">Not calculated</span>
            ) : (
              <MoneyAmount value={line.value} kind={line.kind} currency={currency} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export { RevenueBreakdown }
export type { RevenueBreakdownProps }
