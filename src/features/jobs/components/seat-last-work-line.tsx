"use client";

import { Suspense, use } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatJobDeadline } from "@/features/jobs/lib/job-deadline";
import type { SeatLastWorkState } from "@/features/jobs/lib/get-seat-last-work";
import {
  getLastWorkLine,
  INSPECTION_LOAD_ERROR,
  NO_INSPECTION_YET,
  type WorkTab,
} from "@/features/jobs/lib/job-work-panel";

interface SeatLastWorkLineProps {
  tab: Extract<WorkTab, "cleaning" | "inspection">;
  lastWork: Promise<SeatLastWorkState>;
  timeZone: string;
}

function LastWorkResult({ tab, lastWork, timeZone }: SeatLastWorkLineProps) {
  const router = useRouter();
  const state = use(lastWork);

  if (!state.ok) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-sm text-danger-fg">
        <p>{tab === "inspection" ? INSPECTION_LOAD_ERROR : "Unable to load cleaning. Please try again."}</p>
        <Button type="button" variant="outline" className="min-h-11 rounded-lg bg-surface px-4" onClick={() => router.refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  const last = state.data[tab];

  if (!last) {
    return tab === "inspection" ? <p className="text-sm text-text-muted">{NO_INSPECTION_YET}</p> : null;
  }

  return <p className="text-sm text-foreground">{getLastWorkLine(tab, formatJobDeadline(last.at, timeZone), last.outcome)}</p>;
}

/**
 * The last cleaning or inspection of the seat. The read starts on the server and this waits for it, so the
 * seat and the button show at once and only this line says Loading.
 */
export function SeatLastWorkLine(props: SeatLastWorkLineProps) {
  return (
    <Suspense
      fallback={
        <p role="status" aria-busy="true" className="text-sm text-text-muted">
          {`Loading ${props.tab}…`}
        </p>
      }
    >
      <LastWorkResult {...props} />
    </Suspense>
  );
}
