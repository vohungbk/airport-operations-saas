import { ClockAlertIcon, PlaneLandingIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface FlightAlertProps {
  kind: "early" | "delayed"
  /** How many minutes early or late, always positive. */
  minutes: number
  /** The new time of a deadline that moved with the delay, already formatted for the airport. */
  deadlineMovedTo?: string
  className?: string
}

/** Icon and text as well as color (spec R12). The deadline line shows only when the caller knows it. */
function FlightAlert({ kind, minutes, deadlineMovedTo, className }: FlightAlertProps) {
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
