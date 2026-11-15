"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

function parseMonth(value?: string): { year: number; month: number } | null {
  const match = value ? MONTH_PATTERN.exec(value) : null
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null
}

function toMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

/** `2026-11` reads `Nov 2026` in the box; the value itself stays `YYYY-MM`. */
function formatMonth(value: string): string {
  const parsed = parseMonth(value)
  return parsed ? `${MONTH_LABELS[parsed.month - 1]} ${parsed.year}` : value
}

interface MonthGridProps {
  /** Picked month, `YYYY-MM`. */
  value?: string
  onValueChange?: (value: string) => void
  min?: string
  max?: string
  className?: string
}

/** A year with its twelve months, in the look of the Calendar. */
function MonthGrid({ value, onValueChange, min, max, className }: MonthGridProps) {
  const picked = parseMonth(value)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const [year, setYear] = React.useState(picked?.year ?? currentYear)

  return (
    <div data-slot="month-grid" className={cn("w-fit min-w-0 p-3", className)}>
      <div className="relative mb-2 flex h-8 items-center justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Previous year"
          className="absolute left-0 size-7 bg-transparent p-0 opacity-70 hover:opacity-100"
          onClick={() => setYear((y) => y - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-medium" aria-live="polite">
          {year}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Next year"
          className="absolute right-0 size-7 bg-transparent p-0 opacity-70 hover:opacity-100"
          onClick={() => setYear((y) => y + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTH_LABELS.map((label, index) => {
          const month = toMonth(year, index + 1)
          const selected = month === value
          const isCurrent = year === currentYear && index + 1 === currentMonth
          const disabled = (!!min && month < min) || (!!max && month > max)

          return (
            <button
              key={month}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={month}
              aria-current={isCurrent ? "date" : undefined}
              onClick={() => onValueChange?.(month)}
              className={cn(
                "h-9 w-16 pointer-coarse:min-h-11 pointer-coarse:w-20 rounded-md text-sm font-normal outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
                isCurrent && !selected && "bg-accent text-accent-foreground",
                selected && "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface MonthPickerProps extends Omit<MonthGridProps, "className"> {
  id?: string
  placeholder?: string
  disabled?: boolean
  /** Shows a Clear button under the months when one is picked; it sets the value to an empty string. */
  clearable?: boolean
  "aria-invalid"?: boolean
  "aria-label"?: string
  "aria-describedby"?: string
  className?: string
}

function MonthPicker({
  value,
  onValueChange,
  min,
  max,
  id,
  placeholder = "Pick a month",
  disabled,
  clearable,
  className,
  ...props
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        id={id}
        data-slot="month-picker-trigger"
        disabled={disabled}
        aria-invalid={props["aria-invalid"]}
        aria-label={props["aria-label"]}
        aria-describedby={props["aria-describedby"]}
        className={cn(
          "flex h-11 pointer-coarse:h-11 w-full min-w-0 items-center justify-between gap-1.5 rounded-md border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          !value && "text-muted-foreground",
          className
        )}
      >
        <span className="min-w-0 truncate">{value ? formatMonth(value) : placeholder}</span>
        <CalendarIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={4} className="isolate z-50">
          <PopoverPrimitive.Popup
            data-slot="month-picker-content"
            className="max-w-(--available-width) rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <MonthGrid
              value={value}
              min={min}
              max={max}
              onValueChange={(next) => {
                onValueChange?.(next)
                setOpen(false)
              }}
            />
            {clearable && value && (
              <div className="border-t px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-8 pointer-coarse:min-h-11 w-full"
                  onClick={() => {
                    onValueChange?.("")
                    setOpen(false)
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { MonthGrid, MonthPicker }
export type { MonthGridProps, MonthPickerProps }
