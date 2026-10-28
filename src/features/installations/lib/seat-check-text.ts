import { formatDayMonth, formatTime, zoneLabel } from "@/features/jobs/lib/job-time";

const RESULT_LABEL = new Map([
  ["pass", "Pass"],
  ["conditional_pass", "Conditional pass"],
  ["fail", "Fail"],
]);

/** `Pass` or `Fail` for a cleaning, which stores a boolean; null when it was not recorded. */
export const cleaningOutcome = (passed: boolean | null): string | null =>
  passed === null ? null : passed ? "Pass" : "Fail";

/** The label of an inspection result; an unknown result is shown as it is stored. */
export const inspectionOutcome = (result: string): string => RESULT_LABEL.get(result) ?? result;

/**
 * `24 Oct · 13:20 GST · Pass`: when a check was made, in the zone of the airport, and how it went when that is
 * known.
 */
export function formatCheck(at: string, timeZone: string, outcome: string | null): string {
  return [
    formatDayMonth(at, timeZone),
    `${formatTime(at, timeZone)} ${zoneLabel(timeZone)}`,
    outcome,
  ]
    .filter(Boolean)
    .join(" · ");
}
