import { PhotoThumbnail } from "@/components/domain/photo-viewer"
import { cn } from "@/lib/utils"

interface TimelineEvent {
  id: string
  /** What happened, when the actor and note are not enough (for example a status change). */
  title?: React.ReactNode
  actor: string | null
  occurred_at: string
  note?: string | null
  photos?: readonly { id: string; url: string; alt: string }[]
}

interface TimelineProps {
  events: readonly TimelineEvent[]
  /** Formats a time for the airport (its time zone); the timeline does not pick a zone itself. */
  formatTime: (iso: string) => string
  className?: string
}

/** Events in the order given, each with actor, time, note and photo thumbnails. No events is said, not drawn. */
function Timeline({ events, formatTime, className }: TimelineProps) {
  if (events.length === 0) {
    return (
      <p data-slot="timeline-empty" className={cn("text-sm text-muted-foreground", className)}>
        No events yet.
      </p>
    )
  }

  return (
    <ol data-slot="timeline" className={cn("flex min-w-0 flex-col", className)}>
      {events.map((event) => (
        <li key={event.id} className="relative flex min-w-0 gap-3 pb-4 last:pb-0">
          <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
          <div className="flex min-w-0 flex-col gap-1 text-sm">
            {event.title && <div className="min-w-0 font-medium">{event.title}</div>}
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="min-w-0 break-words font-medium">{event.actor ?? "Unknown"}</span>
              <time dateTime={event.occurred_at} className="text-xs tabular-nums text-muted-foreground">
                {formatTime(event.occurred_at)}
              </time>
            </div>
            {event.note && <p className="break-words text-muted-foreground">{event.note}</p>}
            {event.photos && event.photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {event.photos.map((photo) => (
                  <PhotoThumbnail key={photo.id} url={photo.url} alt={photo.alt} />
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

export { Timeline }
export type { TimelineEvent, TimelineProps }
