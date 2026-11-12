import type { ReactNode } from "react";
import { Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatReportedAt } from "@/features/incidents/lib/incident-time";
import { ReturnChainStepper } from "@/features/return-queue/components/return-chain-stepper";
import {
  buildChainProgress,
  chainStepNumber,
  RETURN_CHAIN_STEPS,
  RETURN_QUEUE_STEP_LABEL,
} from "@/features/return-queue/lib/return-chain";
import type { ReturnQueueItem } from "@/features/return-queue/lib/return-queue";

interface ReturnChainStepProps {
  item: ReturnQueueItem;
  /** `Admin · Full access`. */
  accessLabel: string;
}

function ReadOnlyField({
  id,
  label,
  value,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  hint: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <div className="relative w-full sm:max-w-80">
        <Input
          id={id}
          value={value}
          readOnly
          className="h-11 rounded-lg border-border-input bg-surface-muted pr-10 text-sm"
        />
        <Lock
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
        />
      </div>
      <p className="text-sm text-text-muted">{hint}</p>
    </div>
  );
}

/**
 * The chain step of a seat: the seven steps and the current one. Recording a
 * step (result, checklist, notes, photos) comes with FO-F08-S02; this screen
 * only reads.
 */
export function ReturnChainStep({ item, accessLabel }: ReturnChainStepProps) {
  const failed = item.queue_step === "quarantine";
  const steps = buildChainProgress(item.chain_step, failed);
  const seat = item.seat_serial_number ?? "No seat";
  const context = [
    seat,
    item.booking_number,
    item.partner_name,
    item.step_started_at
      ? formatReportedAt(item.step_started_at, item.time_zone, ", ")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-8 font-semibold text-primary-subtle-foreground">
          Return chain · Active step
        </h1>
        <p className="text-sm text-foreground">
          {[accessLabel, item.airport_code].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm text-foreground">{context}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <ReturnChainStepper steps={steps} />

        <section
          aria-labelledby="return-chain-step-title"
          className="flex flex-col gap-4 border-t border-border pt-4"
        >
          <h2
            id="return-chain-step-title"
            className="text-lg font-semibold text-foreground"
          >
            {`${RETURN_QUEUE_STEP_LABEL[item.chain_step]} · Step ${chainStepNumber(item.chain_step)} of ${RETURN_CHAIN_STEPS.length}`}
          </h2>
          <ReadOnlyField
            id="return-chain-seat"
            label="Seat · read only"
            value={seat}
            hint="Read only"
          />
          <ReadOnlyField
            id="return-chain-booking"
            label="Booking · optional, read only"
            value={item.booking_number}
            hint={[item.partner_name, item.airport_code]
              .filter(Boolean)
              .join(" · ")}
          />
        </section>
      </div>
    </div>
  );
}
