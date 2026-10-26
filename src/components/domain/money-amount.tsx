import { ADJUSTMENT_LABEL, formatAmount, type AdjustmentKind } from "@/lib/money/money"
import { cn } from "@/lib/utils"

interface MoneyAmountProps {
  value: number
  /** A refund or a chargeback is written with its name as well as its minus sign (spec R10). */
  kind?: AdjustmentKind
  /** Shown after the number when the currency is known. */
  currency?: string
  className?: string
}

/** Right aligned, tabular figures. Meaning is the sign and the text, never the color. */
function MoneyAmount({ value, kind, currency, className }: MoneyAmountProps) {
  const { text } = formatAmount(value)

  return (
    <span
      data-slot="money-amount"
      data-kind={kind}
      className={cn("inline-flex min-w-0 items-baseline justify-end gap-1.5 text-right tabular-nums", className)}
    >
      {kind && <span className="text-xs text-muted-foreground">{ADJUSTMENT_LABEL[kind]}</span>}
      <span className="font-medium">{text}</span>
      {currency && <span className="text-xs text-muted-foreground">{currency}</span>}
    </span>
  )
}

export { MoneyAmount }
export type { MoneyAmountProps }
