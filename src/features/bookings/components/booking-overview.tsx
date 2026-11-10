import { ArrowRightIcon, CheckIcon, CircleIcon, PlaneLandingIcon, TriangleAlertIcon } from "lucide-react";

import { FlightAlert } from "@/components/domain/flight-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  buildOverviewFlightAlert,
  buildOverviewGroups,
  buildOverviewSteps,
  formatMinutesInStep,
  type OverviewFlightAlert,
} from "@/features/bookings/lib/booking-overview";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";
import { getFlightDisruption } from "@/lib/flights/flight-timing";
import { stepOf } from "@/lib/workflow/board";
import { cn } from "@/lib/utils";

interface BookingOverviewProps {
  booking: BookingDetailItem;
  timeZone: string;
  /** Whole minutes in the current step; `null` when no event says when it began. */
  minutesInStep: number | null;
  /** The deadline of the installation job, for the moved deadline in the flight alert. */
  deadlineAt: string | null;
  /** Internal notes are for staff: a partner user does not see them. */
  showInternalNotes: boolean;
}

const CARD = "flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5";

function KeyValueGroup({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <section aria-label={title} className={CARD}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="grid min-w-0 grid-cols-1 gap-1 text-sm sm:grid-cols-[200px_1fr] sm:gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 break-words text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FlightAlertCard({ alert }: { alert: OverviewFlightAlert }) {
  return (
    <section
      aria-label="Flight alert"
      role="status"
      data-slot="overview-flight-alert"
      className={cn(CARD, "border-info")}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold break-words text-info-fg">
        <PlaneLandingIcon aria-hidden="true" className="size-4 shrink-0" />
        {alert.title}
      </h2>
      <p className="text-sm font-medium text-foreground">{alert.flightLine}</p>
      <p className="text-sm break-words text-muted-foreground">{alert.detail}</p>
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs text-muted-foreground">Scheduled arrival</p>
          <p className="text-sm font-semibold text-foreground">{alert.scheduled}</p>
        </div>
        <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs text-muted-foreground">Estimated arrival</p>
          <p className="text-sm font-semibold text-foreground">{alert.estimated}</p>
        </div>
      </div>
      <p className="text-xs break-words text-muted-foreground">{alert.dateLine}</p>
      {alert.updated && <p className="text-xs break-words text-muted-foreground">{alert.updated}</p>}
    </section>
  );
}

function WorkflowCard({ status, minutes }: { status: BookingDetailItem["status"]; minutes: number | null }) {
  const steps = buildOverviewSteps(status);
  const onPath = stepOf(status) !== null;

  return (
    <section aria-labelledby="overview-workflow-heading" className={CARD}>
      <div className="flex flex-col gap-1">
        <h2 id="overview-workflow-heading" className="text-sm font-semibold text-foreground">
          Workflow · {BOOKING_STATUS_LABEL[status]}
        </h2>
        {onPath && minutes !== null && (
          <p className="text-sm text-muted-foreground">{formatMinutesInStep(minutes)} in current step</p>
        )}
      </div>
      <ol aria-label="Workflow steps" className="flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.status}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn(
              "flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground",
              step.state === "current" && "border-primary bg-primary-subtle font-semibold text-primary",
              step.state === "upcoming" && "text-muted-foreground",
            )}
          >
            {step.state === "upcoming" ? (
              <CircleIcon aria-hidden="true" className="size-3 shrink-0" />
            ) : (
              <CheckIcon aria-hidden="true" className="size-3 shrink-0" />
            )}
            <span>
              {step.state === "done" ? "Completed · " : step.state === "current" ? "Current · " : ""}
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The Overview tab of a booking (UI-F06-T03): the key-value groups on the left, the flight alert and the
 * workflow on the right. A cancelled booking says so first and is read only.
 */
export function BookingOverview({
  booking,
  timeZone,
  minutesInStep,
  deadlineAt,
  showInternalNotes,
}: BookingOverviewProps) {
  const groups = buildOverviewGroups(booking, timeZone, minutesInStep);
  const flightAlert = buildOverviewFlightAlert(
    booking.flight,
    booking.airport?.code,
    timeZone,
    deadlineAt,
    booking.pickup_at,
  );
  const disruption = getFlightDisruption(booking.flight?.status);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {booking.status === "cancelled" && (
        <Alert>
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>Booking cancelled</AlertTitle>
          <AlertDescription>This booking is read only.</AlertDescription>
        </Alert>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-6">
          {groups.map((group) => (
            <KeyValueGroup key={group.title} title={group.title} rows={group.rows} />
          ))}
          {showInternalNotes && (
            <section aria-labelledby="overview-notes-heading" className={CARD}>
              <h2 id="overview-notes-heading" className="text-sm font-semibold text-foreground">
                Internal notes
              </h2>
              <p className="text-sm break-words whitespace-pre-wrap text-foreground">{booking.notes ?? "-"}</p>
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {disruption && booking.flight && <FlightAlert kind={disruption} />}
          {flightAlert && <FlightAlertCard alert={flightAlert} />}
          <WorkflowCard status={booking.status} minutes={minutesInStep} />
        </div>
      </div>
    </div>
  );
}
