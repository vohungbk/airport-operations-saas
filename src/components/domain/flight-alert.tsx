import { ClockAlertIcon, PlaneLandingIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DISRUPTION_ACTION, getDisruptionTitle } from "@/lib/flights/flight-timing"
import { cn } from "@/lib/utils"

interface FlightAlertProps {
  kind: "early" | "delayed" | "cancelled" | "diverted"
  /** How many minutes early or late, always positive. Not used for a cancelled or diverted flight. */
  minutes?: number
  /** The new time of a deadline that moved with the delay, already formatted for the airport. */
  deadlineMovedTo?: string
  className?: string
}

/** Icon and text as well as color (spec R12). The deadline line shows only when the caller knows it. */
function FlightAlert({ kind, minutes = 0, deadlineMovedTo, className }: FlightAlertProps) {
  if (kind === "cancelled" || kind === "diverted") {
    return (
      <Alert data-slot="flight-alert" data-kind={kind} variant="destructive" className={cn("min-w-0", className)}>
        <TriangleAlertIcon aria-hidden="true" />
        <AlertTitle className="break-words">{getDisruptionTitle(kind)}</AlertTitle>
        <AlertDescription>{DISRUPTION_ACTION}</AlertDescription>
      </Alert>
    )
  }

  const early = kind === "early"
  const Icon = early ? PlaneLandingIcon : ClockAlertIcon
  const unit = minutes === 1 ? "MINUTE" : "MINUTES"

  return (
    <Alert
      data-slot="flight-alert"
      data-kind={kind}
      variant={early ? "success" : "destructive"}
      className={cn("min-w-0", className)}
    >
      <Icon aria-hidden="true" />
      <AlertTitle className="break-words">
        {early ? `ARRIVING ${minutes} ${unit} EARLY` : `DELAYED ${minutes} ${unit}`}
        {!early && deadlineMovedTo !== undefined && ", DEADLINE MOVED"}
      </AlertTitle>
      {!early && deadlineMovedTo !== undefined && (
        <AlertDescription>New deadline: {deadlineMovedTo}</AlertDescription>
      )}
    </Alert>
  )
}

export { FlightAlert }
export type { FlightAlertProps }
