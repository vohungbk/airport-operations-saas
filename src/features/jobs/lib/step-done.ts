import { z } from "zod";

import { formatTime, zoneLabel } from "@/features/jobs/lib/job-time";

/**
 * Pure logic for the success screen of a step (UI-F07-S03, spec R4). The screen is for the steps that end in
 * a record: the installation, the completed cleaning and an inspection that did not fail.
 */

export const STEP_NAMES = ["installation", "cleaning", "inspection"] as const;
export type StepName = (typeof STEP_NAMES)[number];

/** The `step` of the address; anything else is not a step. */
export const stepSchema = z.enum(STEP_NAMES);

export const STEP_COPY: Record<StepName, { heading: string; title: string }> = {
  installation: { heading: "Installation success", title: "Installation completed" },
  cleaning: { heading: "Cleaning success", title: "Cleaning completed" },
  inspection: { heading: "Inspection success", title: "Inspection recorded" },
};

/** Where a step is done: what the success screen writes about it. */
export interface StepDone {
  step: StepName;
  job_id: string;
  booking_number: string;
  airport: { code: string; timezone: string };
  seat: { serial_number: string; category_name: string | null } | null;
  completed_by: string | null;
  /** ISO time the step was recorded. */
  completed_at: string;
}

/** `BK-2026-000123 · Completed at 14:20 GST`: the line under the title of the banner. */
export function bannerLine(done: StepDone): string {
  const { timezone } = done.airport;

  return `${done.booking_number} · Completed at ${formatTime(done.completed_at, timezone)} ${zoneLabel(timezone)}`;
}

/** The seat of the card: the serial, and its category when it has one. */
export function seatLine(done: StepDone): string | null {
  return done.seat
    ? [done.seat.serial_number, done.seat.category_name].filter(Boolean).join(" · ")
    : null;
}
