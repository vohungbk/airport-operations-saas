import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ScanBanner } from "@/features/installations/components/scan-banner";
import { StepActionBar } from "@/features/jobs/components/step-action-bar";
import {
  KeyValue,
  NONE,
  SectionCard,
} from "@/features/jobs/components/today-parts";
import {
  STEP_COPY,
  bannerLine,
  seatLine,
  type StepDone as StepDoneData,
} from "@/features/jobs/lib/step-done";

interface StepDoneProps {
  done: StepDoneData;
  /** The next job of the day; the main action opens it (NAV-3). */
  nextJobId: string | null;
  /** Where the main action goes when there is no next job. */
  backHref: string;
  backLabel: string;
}

/**
 * The success screen of a step (UI-F07-S03, spec R4): the heading, a success banner, a summary of what was
 * recorded, and one main action at the bottom: the next job when another one is waiting, the way back
 * otherwise. The Family Ready status, the vehicle location and the deadline of the design's installation
 * screen have no source yet, so they are not written.
 */
export function StepDone({ done, nextJobId, backHref, backLabel }: StepDoneProps) {
  const { heading, title } = STEP_COPY[done.step];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-24 md:p-8 md:pb-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{heading}</h1>
        <p className="text-sm break-words text-muted-foreground">
          {NONE} · {done.booking_number} · {done.airport.timezone}
        </p>
      </div>

      <ScanBanner tone="success" title={title}>
        {bannerLine(done)}
      </ScanBanner>

      <SectionCard title="Summary">
        <KeyValue label="Seat" mono>
          {seatLine(done) ?? NONE}
        </KeyValue>
        <KeyValue label="Completed by">{done.completed_by ?? NONE}</KeyValue>
      </SectionCard>

      <StepActionBar>
        <Link
          href={nextJobId ? `/jobs/${nextJobId}` : backHref}
          className={buttonVariants({ className: "min-h-11 flex-1 px-4" })}
        >
          {nextJobId ? "Next job" : backLabel}
        </Link>
      </StepActionBar>
    </div>
  );
}
