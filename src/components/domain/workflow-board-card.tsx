import { ChevronUpIcon, ChevronsUpIcon, ClockAlertIcon, EqualIcon, PlaneLandingIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { BOARD_PRIORITY_LABEL, type BoardPriority, type BoardStep } from "@/lib/workflow/board"
import { cn } from "@/lib/utils"

interface WorkflowBoardCardProps {
  booking_ref: string
  subtitle?: string | null
  /** The step the booking is at; null for a booking that is off the path (cancelled, no-show). */
  step: BoardStep | null
  /** A booking status to show as a badge, when the board wants it. */
  status?: string
  /** Set only when the flight is early or delayed past the alert threshold. */
  flight_alert?: { kind: "early" | "delayed"; minutes: number }
  priority?: BoardPriority
  className?: string
}

const PRIORITY_LOOK = {
  normal: { variant: "muted", Icon: EqualIcon },
  high: { variant: "warning", Icon: ChevronUpIcon },
  urgent: { variant: "destructive", Icon: ChevronsUpIcon },
} as const

/** Step, flight alert mark and priority, each by icon and text as well as color (spec R7, R12). */
function WorkflowBoardCard({ booking_ref, subtitle, step, status, flight_alert, priority = "normal", className }: WorkflowBoardCardProps) {
  const { variant, Icon } = PRIORITY_LOOK[priority]
  const delayed = flight_alert?.kind === "delayed"
  const AlertIcon = delayed ? ClockAlertIcon : PlaneLandingIcon

  return (
    <Card data-slot="workflow-board-card" data-priority={priority} className={cn("min-w-0", className)}>
      <CardContent className="flex min-w-0 flex-col gap-2 text-sm">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="min-w-0 truncate font-medium" title={booking_ref}>
              {booking_ref}
            </span>
            {subtitle && <span className="min-w-0 truncate text-xs text-muted-foreground">{subtitle}</span>}
          </div>
          <Badge variant={variant} data-slot="board-priority" className="shrink-0">
            <Icon aria-hidden="true" />
            {BOARD_PRIORITY_LABEL[priority]}
          </Badge>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {status && <StatusBadge domain="booking" value={status} />}
          <span data-slot="board-step" className="text-xs tabular-nums text-muted-foreground">
            {step ? `Step ${step.number} of ${step.total}: ${step.label}` : "Not on the path"}
          </span>
        </div>
        {flight_alert && (
          <Badge variant={delayed ? "destructive" : "success"} data-slot="board-flight-alert" data-kind={flight_alert.kind} className="w-fit">
            <AlertIcon aria-hidden="true" />
            {delayed ? "DELAYED" : "EARLY"} {flight_alert.minutes} MIN
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}

export { WorkflowBoardCard }
export type { WorkflowBoardCardProps }
