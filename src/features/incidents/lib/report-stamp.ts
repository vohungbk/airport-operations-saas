import { formatTime, zoneLabel } from "@/features/jobs/lib/job-time";

/** `04 Nov 2026 11:15 GST`: the moment of a report, in the airport time zone. */
export function formatReportStamp(iso: string, timeZone: string): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));

  return `${date} ${formatTime(iso, timeZone)} ${zoneLabel(timeZone)}`;
}
