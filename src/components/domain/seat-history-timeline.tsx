import { ArrowRightIcon } from "lucide-react"

import { Timeline } from "@/components/domain/timeline"
import { StatusBadge } from "@/components/ui/status-badge"

export interface SeatHistoryEntry {
  id: string
  from_status: string | null
  to_status: string
  changed_by: string | null
  created_at: string
  reason: string | null
}

interface SeatHistoryTimelineProps {
  history: readonly SeatHistoryEntry[]
  formatTime: (iso: string) => string
  className?: string
}

/** Each change of a seat, from the old status to the new one, with who made it and why. Read only. */
function SeatHistoryTimeline({ history, formatTime, className }: SeatHistoryTimelineProps) {
  return (
    <Timeline
      className={className}
      formatTime={formatTime}
      events={history.map((entry) => ({
        id: entry.id,
        actor: entry.changed_by,
        occurred_at: entry.created_at,
        note: entry.reason,
        title: (
          <span className="flex flex-wrap items-center gap-1.5">
            {entry.from_status ? (
              <StatusBadge domain="seat" value={entry.from_status} />
            ) : (
              <span className="text-muted-foreground">Created</span>
            )}
            <ArrowRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <StatusBadge domain="seat" value={entry.to_status} />
          </span>
        ),
      }))}
    />
  )
}

export { SeatHistoryTimeline }
export type { SeatHistoryTimelineProps }
