import { TriangleAlertIcon } from "lucide-react";

import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import type { SeatStatus } from "@/features/seats/types";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { StepDeadlineView } from "@/features/bookings/lib/booking-deadlines";
import type { BookingStatus } from "@/features/bookings/types";

interface BookingStepSummaryProps {
  status: BookingStatus;
  /** `null` when the booking has no seat. */
  seatStatus: SeatStatus | null;
  /** Already formatted, for example "2 h 10 min"; `null` when no event says when the step began. */
  timeInStep: string | null;
  /** The deadline of the next step, already formatted; omitted when the viewer is not to see it or there is none. */
  deadline?: StepDeadlineView | null;
}

const EMPTY = "-";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{children}</dd>
    </div>
  );
}

/** The current step of a booking, the seat status that goes with it and how long it has lasted. */
export function BookingStepSummary({ status, seatStatus, timeInStep, deadline }: BookingStepSummaryProps) {
  const label = BOOKING_STATUS_LABEL[status];

  return (
    <section
      aria-labelledby="booking-current-step-heading"
      className="flex flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-6"
    >
      <h2 id="booking-current-step-heading" className="text-base font-semibold text-foreground">
        Current step
      </h2>
      <p className="text-[28px] font-semibold text-foreground">{label}</p>
      {seatStatus && (
        <div>
          <SeatStatusBadge status={seatStatus} />
        </div>
      )}
      <dl className="flex flex-col gap-4">
        <Row label="Current step">{label}</Row>
        <Row label="Time in step">{timeInStep ?? EMPTY}</Row>
        <Row label="Seat status">{seatStatus ? SEAT_STATUS_LABEL[seatStatus] : EMPTY}</Row>
        {deadline && <Row label="Deadline">{deadline.dueLabel}</Row>}
      </dl>
      {deadline?.overdueLabel && (
        <p className="flex items-center gap-2 text-sm font-semibold text-danger-fg">
          <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
          {deadline.overdueLabel}
        </p>
      )}
    </section>
  );
}
