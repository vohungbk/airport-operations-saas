import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  KeyValue,
  NONE,
  SectionCard,
  terminalLabel,
} from "@/features/jobs/components/today-parts";
import { formatFlightDateTime } from "@/features/flights/lib/flight-panel";
import { formatTime, zoneLabel } from "@/features/jobs/lib/job-time";
import type { TodayJob } from "@/features/jobs/lib/todays-jobs";
import { formatAge, getDataAgeMinutes } from "@/lib/flights/flight-timing";

interface TodayFlightCardProps {
  job: TodayJob;
  /** The time the sync age is counted from. */
  now: Date;
}

type Flight = NonNullable<TodayJob["flight"]>;

function timingLabel({ timing, offset_minutes }: Flight): string {
  const minutes = Math.abs(offset_minutes ?? 0);

  if (timing === "early") return `Early ${minutes} min`;
  if (timing === "delayed") return `Delayed ${minutes} min`;
  return timing === "on_time" ? "On time" : "Status unknown";
}


/**
 * The flight of the job, as the design draws it (UI-F07-S01): its status, the terminal, the scheduled and the
 * estimated arrival in the time zone of the airport, the installation deadline (a dash: no formula yet) and
 * the age of the last sync. The card is not drawn for a job whose booking has no flight.
 */
export function TodayFlightCard({ job, now }: TodayFlightCardProps) {
  const { flight, airport } = job;
  if (!flight) return null;

  const timeZone = airport?.timezone ?? "UTC";
  const synced = flight.last_synced_at
    ? `Provider sync ${formatTime(flight.last_synced_at, timeZone)} ${zoneLabel(timeZone)} · Updated ${formatAge(getDataAgeMinutes(flight.last_synced_at, now))}`
    : null;

  return (
    <SectionCard
      title={`${flight.flight_number}${airport ? ` · ${airport.city} arrival` : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <Badge variant="info">
          <Info aria-hidden="true" />
          {timingLabel(flight)}
        </Badge>
        {flight.terminal && (
          <p className="text-sm whitespace-nowrap text-muted-foreground">
            {terminalLabel(flight.terminal)}
          </p>
        )}
      </div>
      <KeyValue label={`Scheduled · ${timeZone}`}>
        {formatFlightDateTime(flight.scheduled_at, timeZone, NONE)}
      </KeyValue>
      <KeyValue label={`Estimated · ${timeZone}`}>
        {formatFlightDateTime(flight.expected_at, timeZone, NONE)}
      </KeyValue>
      <KeyValue label="Installation deadline">{NONE}</KeyValue>
      {synced && <p className="text-sm text-muted-foreground">{synced}</p>}
    </SectionCard>
  );
}
