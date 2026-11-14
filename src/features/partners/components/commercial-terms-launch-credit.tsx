import type { CSSProperties } from "react";

import type { LaunchCreditProgress } from "@/features/partners/lib/commercial-terms";
import { formatMoneyText } from "@/features/partners/lib/commercial-terms";

interface CommercialTermsLaunchCreditProps {
  progress: LaunchCreditProgress;
}

/** The "Launch credit" card of the design: what has been counted so far against the target. */
export function CommercialTermsLaunchCredit({ progress }: CommercialTermsLaunchCreditProps) {
  return (
    <section aria-labelledby="launch-credit-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id="launch-credit-heading" className="text-sm font-semibold text-foreground">
          Launch credit
        </h2>
        <span className="text-xs text-muted-foreground">{progress.percent}% reached</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-foreground">
        USD {formatMoneyText(progress.accumulated)}
      </p>
      <p className="text-xs text-muted-foreground">of USD {formatMoneyText(progress.target)} target</p>
      <div
        role="progressbar"
        aria-label="Launch credit reached"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full w-(--reached) rounded-full bg-primary"
          style={{ "--reached": `${progress.percent}%` } as CSSProperties}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        When the target is reached, new completed rentals switch to the standard share automatically.
      </p>
    </section>
  );
}
