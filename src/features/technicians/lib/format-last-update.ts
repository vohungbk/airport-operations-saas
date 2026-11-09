import { formatDate, formatTime, zoneLabel } from "@/features/jobs/lib/job-time";

/** Pure — `24 Oct 2026, 14:30 GST`: the time in the zone of the airport. */
export function formatLastUpdate(iso: string, timeZone: string): string {
  return `${formatDate(iso, timeZone)}, ${formatTime(iso, timeZone)} ${zoneLabel(timeZone)}`;
}
