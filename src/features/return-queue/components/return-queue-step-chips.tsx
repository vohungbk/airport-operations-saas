import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { buildReturnQueueHref } from "@/features/return-queue/lib/build-return-queue-href";
import {
  RETURN_QUEUE_STEPS,
  RETURN_QUEUE_STEP_LABEL,
  type ReturnQueueStep,
} from "@/features/return-queue/lib/return-chain";
import type { ReturnQueueQuery } from "@/features/return-queue/schemas/return-queue-query.schema";

interface ReturnQueueStepChipsProps {
  query: ReturnQueueQuery;
  stepCounts: Record<ReturnQueueStep, number>;
  allCount: number;
}

/**
 * The step chips of the design with the number of seats at each step. Links,
 * so the filter is in the address. A chip goes back to page 1.
 */
export function ReturnQueueStepChips({
  query,
  stepCounts,
  allCount,
}: ReturnQueueStepChipsProps) {
  const chips: { label: string; step: ReturnQueueStep | undefined; count: number }[] = [
    { label: "All", step: undefined, count: allCount },
    ...RETURN_QUEUE_STEPS.map((step) => ({
      label: RETURN_QUEUE_STEP_LABEL[step],
      step,
      count: stepCounts[step],
    })),
  ];

  return (
    <nav
      aria-label="Current step"
      className="flex w-fit max-w-full flex-wrap gap-3 rounded-lg border border-border bg-surface p-4"
    >
      {chips.map(({ label, step, count }) => {
        const active = query.step === step;

        return (
          <Link
            key={label}
            href={buildReturnQueueHref(query, { step, page: 1 })}
            aria-current={active ? "page" : undefined}
            className={buttonVariants({
              variant: active ? "default" : "outline",
              className: "min-h-11 rounded-lg px-4",
            })}
          >
            {`${label} ${count}`}
          </Link>
        );
      })}
    </nav>
  );
}
