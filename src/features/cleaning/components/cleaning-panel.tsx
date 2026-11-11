"use client";

import Link from "next/link";
import {
  CircleCheckIcon,
  CircleAlertIcon,
  LockIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CleaningCompleteDialog } from "@/features/cleaning/components/cleaning-complete-dialog";
import { CleaningConflictAlert } from "@/features/cleaning/components/cleaning-conflict-alert";
import type { CleaningPanelView } from "@/features/cleaning/lib/build-cleaning-panel-view";
import { isAlreadyRecordedError } from "@/features/cleaning/lib/cleaning-errors";
import { useStartCleaning } from "@/features/cleaning/hooks/use-start-cleaning";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { StepActionBar } from "@/features/jobs/components/step-action-bar";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";

interface CleaningPanelProps {
  view: CleaningPanelView;
}

const NOTICE_TONE = {
  success: "border-success-fg/40 bg-success-bg text-success-fg",
  danger: "border-danger-fg/40 bg-danger-bg text-danger-fg",
  warning: "border-warning-fg/40 bg-warning-bg text-warning-fg",
} as const;

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: keyof typeof NOTICE_TONE;
  icon: typeof CircleCheckIcon;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={`flex gap-3 rounded-lg border p-3 text-sm ${NOTICE_TONE[tone]}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

/**
 * The Cleaning panel of the Admin and Operations Manager, one component for
 * every state of the design: Not started, In progress, Completed, Failed
 * (with the Quarantine view) and Blocked by booking. The state and the lines
 * come from the server; this only draws them and wires the two actions.
 */
export function CleaningPanel({ view }: CleaningPanelProps) {
  const { start, isPending, result, viewCleaning } = useStartCleaning(
    view.jobId,
  );
  const error = result && !result.success ? result.error : undefined;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Cleaning</h2>
        <p className="text-sm text-foreground">{view.seatSerial}</p>
        <div>
          <SeatStatusBadge status={view.seatStatus} />
        </div>

        {error &&
          (isAlreadyRecordedError(error) ? (
            <CleaningConflictAlert
              message="Someone started this cleaning first."
              onViewRecord={viewCleaning}
            />
          ) : (
            <JobActionErrorAlert
              error={error}
              onRetry={start}
              fallbackTitle="Could not start the cleaning"
            />
          ))}

        {view.state === "not_started" && (
          <>
            <p className="text-sm text-foreground">
              Start cleaning after confirming there is no conflicting booking.
            </p>
            <StepActionBar>
              <Button
                type="button"
                onClick={start}
                disabled={isPending}
                className="min-h-11 w-full px-4"
              >
                {isPending ? "Starting..." : "Start cleaning"}
              </Button>
            </StepActionBar>
            {view.lastCleaning && (
              <p className="text-sm text-foreground">
                Last cleaning: {view.lastCleaning}
              </p>
            )}
          </>
        )}

        {view.state === "blocked" && view.conflict && (
          <>
            <p className="text-sm text-foreground">
              Booking holds this seat during the requested cleaning period.
            </p>
            <Notice tone="warning" icon={TriangleAlertIcon}>
              <p className="font-semibold">This seat is booked in this period</p>
              <p>
                {view.conflict.bookingNumber} · {view.conflict.period}
              </p>
            </Notice>
            <p className="text-sm text-foreground">
              <Link
                href={`/bookings/${view.conflict.bookingId}`}
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                {view.conflict.bookingNumber}
              </Link>{" "}
              · {view.conflict.period}
            </p>
            <LockIcon aria-hidden="true" className="size-4 text-primary" />
            <StepActionBar>
              <Button
                type="button"
                variant="outline"
                disabled
                className="min-h-11 w-full bg-surface px-4"
              >
                Start cleaning - blocked
              </Button>
            </StepActionBar>
          </>
        )}

        {view.state === "in_progress" && (
          <>
            <p className="text-sm text-foreground">{view.startedLine}</p>
            <StepActionBar>
              <CleaningCompleteDialog
                jobId={view.jobId}
                seatSerial={view.seatSerial}
              />
            </StepActionBar>
          </>
        )}

        {view.state === "completed_passed" && (
          <>
            <p className="text-sm text-foreground">{view.completedLine}</p>
            <Notice tone="success" icon={CircleCheckIcon}>
              <p className="font-semibold">Cleaning complete. Seat is Available.</p>
            </Notice>
          </>
        )}

        {view.state === "failed" && (
          <>
            <p className="text-sm text-foreground">{view.failedLine}</p>
            <Notice tone="danger" icon={CircleAlertIcon}>
              <p className="font-semibold">
                Seat stays out of service. Decide the next step.
              </p>
            </Notice>
            <div className="flex flex-col gap-2">
              <Link
                href={`/incidents/new?job_id=${view.jobId}`}
                className={buttonVariants({ className: "min-h-11 w-full px-4" })}
              >
                Create incident
              </Link>
              <Link
                href="/return-queue"
                className={buttonVariants({
                  variant: "outline",
                  className: "min-h-11 w-full bg-surface px-4",
                })}
              >
                View Return queue
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
