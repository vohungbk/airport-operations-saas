import { MoneyAmount } from "@/components/domain/money-amount"
import { cn } from "@/lib/utils"

interface InvoiceSummaryProps {
  subtotal: number
  vat: number
  total: number
  /** The VAT rate, if known, for example 10. */
  vatRatePercent?: number | null
  currency?: string
  className?: string
}

/** The three stored figures of an invoice, as they are: the total is not recalculated here. */
function InvoiceSummary({ subtotal, vat, total, vatRatePercent, currency, className }: InvoiceSummaryProps) {
  const vatLabel = vatRatePercent == null ? "VAT" : `VAT (${vatRatePercent}%)`

  return (
    <dl data-slot="invoice-summary" className={cn("grid min-w-0 grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm", className)}>
      <dt className="text-muted-foreground">Subtotal</dt>
      <dd className="text-right"><MoneyAmount value={subtotal} currency={currency} /></dd>
      <dt className="text-muted-foreground">{vatLabel}</dt>
      <dd className="text-right"><MoneyAmount value={vat} currency={currency} /></dd>
      <dt className="border-t border-border pt-2 font-medium">Total</dt>
      <dd className="border-t border-border pt-2 text-right"><MoneyAmount value={total} currency={currency} className="text-base" /></dd>
    </dl>
  )
}

export { InvoiceSummary }
export type { InvoiceSummaryProps }
