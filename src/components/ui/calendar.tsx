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
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const grid = buildMonthGrid(view.year, view.month)
  const title = new Date(Date.UTC(view.year, view.month - 1, 1)).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

  return (
    <div data-slot="calendar" className={cn("w-fit max-w-72 min-w-0 p-3 pointer-coarse:max-w-[22rem]", className)}>
      <div className="relative mb-2 flex h-8 items-center justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          className="absolute left-0 size-7 bg-transparent p-0 opacity-70 hover:opacity-100"
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
          className="absolute right-0 size-7 bg-transparent p-0 opacity-70 hover:opacity-100"
          onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="grid grid-cols-7 text-center text-[0.8rem] font-normal text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d} className="flex size-8 items-center justify-center pointer-coarse:size-11">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7">
        {grid.map((cell) => {
          const selected = cell.iso === value
          const disabled = isDateOutOfRange(cell.iso, min, max)
          const isToday = cell.iso === todayIso
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={cell.iso}
              data-outside={!cell.inMonth || undefined}
              aria-current={isToday ? "date" : undefined}
              onClick={() => onValueChange?.(cell.iso)}
              className={cn(
                "size-8 pointer-coarse:size-11 pointer-coarse:min-h-11 rounded-md text-sm font-normal outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 data-outside:text-muted-foreground",
                isToday && !selected && "bg-accent text-accent-foreground",
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
