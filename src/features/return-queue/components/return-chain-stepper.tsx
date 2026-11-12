import { CircleCheck, CircleX, Clock, Lock, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  RETURN_CHAIN_STEP_STATE_LABEL,
  type ReturnChainProgressStep,
  type ReturnChainStepState,
} from "@/features/return-queue/lib/return-chain";

interface ReturnChainStepperProps {
  steps: ReturnChainProgressStep[];
}

const STATE_ICON: Record<ReturnChainStepState, LucideIcon> = {
  completed: CircleCheck,
  current: Clock,
  failed: CircleX,
  locked: Lock,
};

/**
 * The seven steps of the chain as tiles: done, current (or failed) and
 * locked. Each state has an icon and text, never color alone.
 */
export function ReturnChainStepper({ steps }: ReturnChainStepperProps) {
  return (
    <ol
      aria-label="Return chain"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
    >
      {steps.map(({ step, label, state }) => {
        const Icon = STATE_ICON[state];
        const active = state === "current" || state === "failed";

        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-0 flex-col gap-1 rounded-lg p-3 text-sm leading-5",
              active ? "bg-primary-subtle" : "bg-surface-muted",
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "size-4",
                state === "failed" ? "text-danger-fg" : "text-primary",
              )}
            />
            <span className="break-words text-foreground">{label}</span>
            <span className="text-text-muted">
              {RETURN_CHAIN_STEP_STATE_LABEL[state]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
