import { CheckIcon, CircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingStatus } from "@/features/bookings/types";
import { BOOKING_BOARD_STEPS, stepOf } from "@/lib/workflow/board";

interface BookingStepperProps {
  status: BookingStatus;
}

/**
 * The steps of a booking in order (CO-F08-S06): the steps behind it are checked, the current one is
 * blue and bold. A booking off the path (cancelled, no-show) has no current step.
 */
export function BookingStepper({ status }: BookingStepperProps) {
  const current = stepOf(status);
  const currentIndex = current ? current.number - 1 : -1;

  return (
    <section
      aria-labelledby="booking-workflow-heading"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="booking-workflow-heading" className="text-base font-semibold text-foreground">
          Booking workflow
        </h2>
        {current && (
          <p className="text-sm text-muted-foreground">
            Step {current.number} of {current.total}
          </p>
        )}
      </div>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {BOOKING_BOARD_STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-sm",
                isCurrent ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {isDone ? (
                <CheckIcon aria-hidden="true" className="size-3 shrink-0" />
              ) : (
                <CircleIcon aria-hidden="true" className="size-3 shrink-0" />
              )}
              <span>{BOOKING_STATUS_LABEL[step]}</span>
              {isDone && <span className="sr-only">(done)</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
