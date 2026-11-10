"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { formatLocalDateTime, formatTimeZoneLabel } from "@/features/bookings/lib/booking-time"
import { cn } from "@/lib/utils"

const DEFAULT_HOUR = "09"
const DEFAULT_MINUTE = "00"

const pad = (value: string) => value.padStart(2, "0")

function clamp(value: string, max: number, fallback: string) {
  const number = Number.parseInt(value, 10)
  return Number.isNaN(number) ? fallback : pad(String(Math.min(Math.max(number, 0), max)))
}

interface DateTimePickerProps {
  /** `YYYY-MM-DDTHH:mm`, or an empty string when nothing is chosen. */
  value: string
  onValueChange: (value: string) => void
  id?: string
  placeholder?: string
  /** The time zone of the value, for example `Asia/Dubai`; named next to the time. */
  timeZone?: string | null
  disabled?: boolean
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  className?: string
}

/**
 * A day from the calendar and a time of day in one value. The value is the wall-clock time of the
 * airport; the picker never converts it.
 */
function DateTimePicker({
  value,
  onValueChange,
  id,
  placeholder = "Choose date and time",
  timeZone,
  disabled,
  className,
  ...props
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [draftDate, setDraftDate] = React.useState("")
  const [hour, setHour] = React.useState(DEFAULT_HOUR)
  const [minute, setMinute] = React.useState(DEFAULT_MINUTE)
  const text = formatLocalDateTime(value)
  const zoneLabel = timeZone ? formatTimeZoneLabel(timeZone) : null
  const zoneShort = zoneLabel?.match(/\(([^)]+)\)$/)?.[1] ?? null

  // The picker works on a draft; the value changes only when the person applies it.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      const [date = "", time = ""] = value ? value.split("T") : []
      setDraftDate(date)
      setHour(time ? time.slice(0, 2) : DEFAULT_HOUR)
      setMinute(time ? time.slice(3, 5) : DEFAULT_MINUTE)
    }
    setOpen(next)
  }

  const apply = () => {
    if (!draftDate) return
    onValueChange(`${draftDate}T${clamp(hour, 23, DEFAULT_HOUR)}:${clamp(minute, 59, DEFAULT_MINUTE)}`)
    setOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        id={id}
        data-slot="date-time-picker-trigger"
        disabled={disabled}
        aria-invalid={props["aria-invalid"]}
        aria-describedby={props["aria-describedby"]}
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          !text && "text-muted-foreground",
          className
        )}
      >
        <span className="min-w-0 truncate">{text || placeholder}</span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={4} className="isolate z-50">
          <PopoverPrimitive.Popup
            data-slot="date-time-picker-content"
            className="w-(--anchor-width) max-w-(--available-width) rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <Calendar
              value={draftDate || undefined}
              onValueChange={setDraftDate}
              className="max-w-none pointer-coarse:max-w-none"
            />
            <div className="flex flex-col gap-3 p-3 pt-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Time{zoneShort ? ` (${zoneShort})` : ""} :</span>
                <Input
                  aria-label="Hour"
                  inputMode="numeric"
                  maxLength={2}
                  value={hour}
                  onChange={(event) => setHour(event.target.value.replace(/\D/g, ""))}
                  className="h-11 w-14 text-center"
                />
                <Input
                  aria-label="Minute"
                  inputMode="numeric"
                  maxLength={2}
                  value={minute}
                  onChange={(event) => setMinute(event.target.value.replace(/\D/g, ""))}
                  className="h-11 w-14 text-center"
                />
              </div>
              {zoneLabel && <p className="text-sm text-muted-foreground">{zoneLabel}</p>}
              <Button type="button" className="min-h-11 w-full" disabled={!draftDate} onClick={apply}>
                Apply date and time
              </Button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { DateTimePicker }
export type { DateTimePickerProps }
