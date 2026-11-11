"use client";

import { useState } from "react";
import Link from "next/link";
import { ScanLine } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import { SeatLastWorkLine } from "@/features/jobs/components/seat-last-work-line";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";
import {
  getJobWorkTab,
  getNoTaskMessage,
  getWorkActionLabel,
  NOT_ASSIGNED_MESSAGE,
  getWorkPanelHint,
  WORK_TABS,
  WORK_TAB_LABEL,
  type WorkTab,
} from "@/features/jobs/lib/job-work-panel";
import type { SeatLastWorkState } from "@/features/jobs/lib/get-seat-last-work";
import type { SeatStatus } from "@/features/seats/types";
import { cn } from "@/lib/utils";

interface JobWorkTabsProps {
  jobType: JobType;
  jobStatus: JobStatus;
  seat: { id: string; serial_number: string; status: SeatStatus } | null;
  /** Whether the seat name links to the seat page. */
  seatLink: boolean;
  workRecordHref: string | null;
  scanHref: string | null;
  lastWork: Promise<SeatLastWorkState> | null;
  timeZone: string;
}

/**
 * The panel of the design: the tabs Cleaning, Inspection and Return, and under them the seat, where the job
 * stands, the button to start the work and the last time the seat was cleaned or inspected. The tab of the
 * job is open first, and only that tab has the buttons. An installation job has no tab and shows its own
 * panel.
 */
export function JobWorkTabs({
  jobType,
  jobStatus,
  seat,
  seatLink,
  workRecordHref,
  scanHref,
  lastWork,
  timeZone,
}: JobWorkTabsProps) {
  const own = getJobWorkTab(jobType);
  const [tab, setTab] = useState<WorkTab>(own ?? "cleaning");
  // An installation job has no tab of its own, so its buttons show under the Cleaning and Return tabs. The
  // Inspection tab is only for an inspection job: any other job has no inspection task (design E10.05).
  const isOwn = tab === "inspection" ? own === "inspection" : own === null || tab === own;
  const title = WORK_TAB_LABEL[tab];
  // An active inspection job with no button is one the user may not record.
  const notAssigned =
    isOwn &&
    tab === "inspection" &&
    (jobStatus === "assigned" || jobStatus === "in_progress") &&
    !workRecordHref;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Work" className="grid grid-cols-3 gap-3">
        {WORK_TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`job-work-tab-${value}`}
            aria-selected={tab === value}
            aria-controls="job-work-panel"
            onClick={() => setTab(value)}
            className={cn(
              buttonVariants({ variant: tab === value ? "default" : "outline" }),
              "min-h-11 rounded-lg px-4",
              tab !== value && "bg-surface",
            )}
          >
            {WORK_TAB_LABEL[value]}
          </button>
        ))}
      </div>

      <Card>
        <CardContent
          id="job-work-panel"
          role="tabpanel"
          aria-labelledby={`job-work-tab-${tab}`}
          className="flex flex-col gap-3"
        >
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {seat && (
            <>
              {seatLink ? (
                <Link
                  href={`/seats/${seat.id}`}
                  className="w-fit text-sm text-primary underline underline-offset-2 hover:no-underline"
                >
                  {seat.serial_number}
                </Link>
              ) : (
                <span className="text-sm">{seat.serial_number}</span>
              )}
              <div>
                <SeatStatusBadge status={seat.status} />
              </div>
            </>
          )}
          <p className="text-sm text-foreground">
            {isOwn ? getWorkPanelHint(jobStatus, jobType) : getNoTaskMessage(tab)}
          </p>
          {isOwn && (workRecordHref || scanHref) && (
            <div className="flex flex-col gap-2">
              {workRecordHref && (
                <Link
                  href={workRecordHref}
                  className={buttonVariants({ className: "min-h-11 w-full rounded-lg px-4" })}
                >
                  {getWorkActionLabel(jobStatus, jobType)}
                </Link>
              )}
              {scanHref && (
                <Link
                  href={scanHref}
                  className={buttonVariants({ variant: "outline", className: "min-h-11 w-full rounded-lg bg-surface px-4" })}
                >
                  <ScanLine aria-hidden="true" data-icon="inline-start" />
                  Scan assigned seat
                </Link>
              )}
            </div>
          )}
          {notAssigned && (
            <>
              <p role="status" className="text-sm text-danger-fg">
                {NOT_ASSIGNED_MESSAGE}
              </p>
              <Button type="button" disabled className="min-h-11 w-full rounded-lg px-4">
                {getWorkActionLabel(jobStatus, jobType)}
              </Button>
            </>
          )}
          {lastWork && isOwn && (tab === "cleaning" || tab === "inspection") && (
            <SeatLastWorkLine tab={tab} lastWork={lastWork} timeZone={timeZone} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
