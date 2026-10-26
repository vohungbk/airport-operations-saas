import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface KanbanColumnProps {
  title: string
  /** How many cards the column holds. At 0 the column says it is empty and shows no count. */
  count: number
  empty_message?: string
  children?: React.ReactNode
  className?: string
}

/** A step of the board with its count and cards. An empty column is worded, not shown as 0 (spec E5). */
function KanbanColumn({ title, count, empty_message = "Nothing in this step.", children, className }: KanbanColumnProps) {
  const empty = count <= 0

  return (
    <section data-slot="kanban-column" data-empty={empty || undefined} aria-label={title} className={cn("flex min-w-0 flex-col gap-2 rounded-lg bg-muted p-2", className)}>
      <header className="flex min-w-0 items-center justify-between gap-2 px-1">
        <h3 className="min-w-0 truncate text-sm font-medium" title={title}>
          {title}
        </h3>
        {!empty && (
          <Badge variant="secondary" data-slot="kanban-count" className="shrink-0 tabular-nums">
            {count}
          </Badge>
        )}
      </header>
      {empty ? (
        <p data-slot="kanban-empty" className="px-1 py-4 text-center text-sm text-muted-foreground">
          {empty_message}
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-2">{children}</div>
      )}
    </section>
  )
}

export { KanbanColumn }
export type { KanbanColumnProps }
