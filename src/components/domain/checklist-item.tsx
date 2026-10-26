"use client"

import { AsteriskIcon, TriangleAlertIcon } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface ChecklistItemProps {
  label: string
  checked: boolean
  required?: boolean
  disabled?: boolean
  /** A required item was left open: the row says so in words and with an icon, not by color alone. */
  show_error?: boolean
  on_checked_change?: (checked: boolean) => void
  className?: string
}

/** The whole row is the target, at least 44 px high on a touch screen (spec R14). */
function ChecklistItem({ label, checked, required = false, disabled = false, show_error = false, on_checked_change, className }: ChecklistItemProps) {
  const error = show_error && required && !checked

  return (
    <div data-slot="checklist-item" data-required={required || undefined} data-error={error || undefined} className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label
        className={cn(
          "flex min-w-0 items-start gap-3 rounded-lg border border-border p-3 text-sm pointer-coarse:min-h-11",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          error && "border-destructive",
        )}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          aria-invalid={error || undefined}
          onCheckedChange={(next) => on_checked_change?.(next)}
        />
        <span className="min-w-0 flex-1 break-words">{label}</span>
        {required && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
            <AsteriskIcon className="size-3" aria-hidden="true" />
            Required
          </span>
        )}
      </label>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-danger-fg">
          <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
          This item is required.
        </p>
      )}
    </div>
  )
}

export { ChecklistItem }
export type { ChecklistItemProps }
