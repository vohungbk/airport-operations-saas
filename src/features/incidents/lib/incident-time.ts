import { formatTime, zoneLabel } from "@/features/jobs/lib/job-time";

/**
 * `04 Nov 2026 11:15 GST`: when an incident was reported, in the airport time
 * zone. The page header puts a comma between the date and the time.
 */
export function formatReportedAt(
  iso: string,
  timeZone: string,
  separator = " ",
): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));

  return `${date}${separator}${formatTime(iso, timeZone)} ${zoneLabel(timeZone)}`;
}
