import { ClockIcon, TriangleAlertIcon } from "lucide-react"

import { FlightAlert } from "@/components/domain/flight-alert"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  ALERT_THRESHOLD_MINUTES,
  STALE_AFTER_MINUTES,
  classifyFlight,
  formatAge,
  getDataAgeMinutes,
  getFlightOffsetMinutes,
  isStale,
} from "@/lib/flights/flight-timing"
import { cn } from "@/lib/utils"

export interface FlightStatusCardFlight {
  flight_number: string
  status: string
  terminal: string | null
  scheduled_arrival_at: string
  estimated_arrival_at: string | null
  actual_arrival_at: string | null
  delay_minutes: number | null
  last_synced_at: string | null
}

interface FlightStatusCardProps {
  flight: FlightStatusCardFlight
  /** Formats a time for the airport (its time zone); the card does not pick a zone itself. */
  formatTime: (iso: string) => string
  /** Passed in, so the age is the same on the server and in a test. */
  now: Date
  deadlineMovedTo?: string
  alertThresholdMinutes?: number
  staleAfterMinutes?: number
  className?: string
}

/** Shows the flight as it is stored: no value is made up, and an absent one is shown as "-". */
function FlightStatusCard({
  flight,
  formatTime,
  now,
  deadlineMovedTo,
  alertThresholdMinutes = ALERT_THRESHOLD_MINUTES,
  staleAfterMinutes = STALE_AFTER_MINUTES,
  className,
}: FlightStatusCardProps) {
  const offset = getFlightOffsetMinutes(flight)
  const timing = classifyFlight(offset, alertThresholdMinutes)
  const age = getDataAgeMinutes(flight.last_synced_at, now)
  const stale = isStale(age, staleAfterMinutes)
  const showAlert = flight.status !== "cancelled" && flight.status !== "diverted"

  return (
    <Card data-slot="flight-status-card" data-stale={stale || undefined} className={cn("min-w-0", className)}>
      <CardHeader>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CardTitle className="min-w-0 truncate" title={flight.flight_number}>
            {flight.flight_number}
          </CardTitle>
          <StatusBadge domain="flight" value={flight.status} />
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3 text-sm">
        {showAlert && (timing === "early" || timing === "delayed") && offset !== null && (
          <FlightAlert
            kind={timing}
            minutes={Math.abs(offset)}
            deadlineMovedTo={timing === "delayed" ? deadlineMovedTo : undefined}
          />
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Item label="Scheduled">{formatTime(flight.scheduled_arrival_at)}</Item>
          <Item label="Estimated">
            {flight.estimated_arrival_at ? formatTime(flight.estimated_arrival_at) : "-"}
          </Item>
          <Item label="Terminal">{flight.terminal ?? "-"}</Item>
          <Item label="Last update">
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
              {formatAge(age)}
            </span>
          </Item>
        </dl>
        {stale && (
          <Alert data-slot="flight-stale" className="min-w-0">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertDescription>
              {age === null
                ? "Flight data has never been updated. Times may be wrong."
                : `Flight data is ${formatAge(age).replace(" ago", "")} old. Times may be wrong.`}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium tabular-nums">{children}</dd>
    </div>
  )
}

export { FlightStatusCard }
export type { FlightStatusCardProps }
