"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  buildMonthGrid,
  isDateOutOfRange,
  parseIsoDate,
  shiftMonth,
} from "@/lib/forms/date"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

interface CalendarProps {
  /** Picked day, `YYYY-MM-DD`. */
  value?: string
  onValueChange?: (value: string) => void
  min?: string
  max?: string
  className?: string
}

function Calendar({ value, onValueChange, min, max, className }: CalendarProps) {
  const picked = value ? parseIsoDate(value) : null
  const today = new Date()
  const [view, setView] = React.useState({
    year: picked?.year ?? today.getFullYear(),
    month: picked?.month ?? today.getMonth() + 1,
  })
  const grid = buildMonthGrid(view.year, view.month)
  const title = new Date(Date.UTC(view.year, view.month - 1, 1)).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

  return (
    <div data-slot="calendar" className={cn("w-full max-w-72 min-w-0 p-2 pointer-coarse:max-w-[22rem]", className)}>
      <div className="mb-2 flex items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="truncate text-sm font-medium" aria-live="polite">
          {title}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {grid.map((cell) => {
          const selected = cell.iso === value
          const disabled = isDateOutOfRange(cell.iso, min, max)
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={cell.iso}
              data-outside={!cell.inMonth || undefined}
              onClick={() => onValueChange?.(cell.iso)}
              className={cn(
                "aspect-square pointer-coarse:aspect-auto pointer-coarse:min-h-11 rounded-md text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 data-outside:text-muted-foreground",
                selected && "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { Calendar }
export type { CalendarProps }
