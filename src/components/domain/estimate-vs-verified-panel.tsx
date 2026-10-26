import { EstimateTag } from "@/components/domain/estimate-tag"
import { MoneyAmount } from "@/components/domain/money-amount"
import { sumVerified, type EstimatedLine, type VerifiedLine } from "@/lib/money/money"
import { cn } from "@/lib/utils"

interface EstimateVsVerifiedPanelProps {
  verified: readonly VerifiedLine[]
  estimated: readonly EstimatedLine[]
  currency?: string
  className?: string
}

/**
 * Verified and estimated numbers apart (spec R3, R11). The total is of the verified lines only: an
 * estimate has no `amount`, so it cannot be added in. Each estimate carries its tag.
 */
function EstimateVsVerifiedPanel({ verified, estimated, currency, className }: EstimateVsVerifiedPanelProps) {
  return (
    <div data-slot="estimate-vs-verified" className={cn("grid min-w-0 gap-4 md:grid-cols-2", className)}>
      <section aria-labelledby="verified-heading" data-slot="verified-section" className="flex min-w-0 flex-col gap-2">
        <h3 id="verified-heading" className="text-sm font-medium">Verified</h3>
        {verified.length === 0 ? (
          <p className="text-sm text-muted-foreground">No verified figures yet.</p>
        ) : (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            {verified.map((line, index) => (
              <div key={`${index}-${line.label}`} className="col-span-2 grid grid-cols-subgrid items-baseline">
                <dt className="min-w-0 break-words text-muted-foreground">{line.label}</dt>
                <dd className="text-right"><MoneyAmount value={line.amount} kind={line.kind} currency={currency} /></dd>
              </div>
            ))}
            <dt className="border-t border-border pt-2 font-medium">Verified total</dt>
            <dd className="border-t border-border pt-2 text-right">
              <MoneyAmount value={sumVerified(verified)} currency={currency} />
            </dd>
          </dl>
        )}
      </section>
      <section aria-labelledby="estimated-heading" data-slot="estimated-section" className="flex min-w-0 flex-col gap-2">
        <h3 id="estimated-heading" className="text-sm font-medium">Estimated</h3>
        {estimated.length === 0 ? (
          <p className="text-sm text-muted-foreground">No estimates.</p>
        ) : (
          <>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              {estimated.map((line, index) => (
                <div key={`${index}-${line.label}`} className="col-span-2 grid grid-cols-subgrid items-baseline">
                  <dt className="min-w-0 break-words text-muted-foreground">{line.label}</dt>
                  <dd className="flex items-baseline justify-end gap-2 text-right">
                    <EstimateTag />
                    <MoneyAmount value={line.estimate} currency={currency} />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">Estimates are not part of the verified total.</p>
          </>
        )}
      </section>
    </div>
  )
}

export { EstimateVsVerifiedPanel }
export type { EstimateVsVerifiedPanelProps }
