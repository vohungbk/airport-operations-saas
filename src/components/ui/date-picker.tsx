"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { CalendarIcon } from "lucide-react"

import { Calendar, type CalendarProps } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface DatePickerProps extends Omit<CalendarProps, "className"> {
  placeholder?: string
  disabled?: boolean
  "aria-invalid"?: boolean
  className?: string
}

function DatePicker({
  value,
  onValueChange,
  min,
  max,
  placeholder = "Pick a date",
  disabled,
  className,
  ...props
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        data-slot="date-picker-trigger"
        disabled={disabled}
        aria-invalid={props["aria-invalid"]}
        className={cn(
          "flex h-8 pointer-coarse:h-11 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          !value && "text-muted-foreground",
          className
        )}
      >
        <span className="min-w-0 truncate">{value ?? placeholder}</span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={4} className="isolate z-50">
          <PopoverPrimitive.Popup
            data-slot="date-picker-content"
            className="max-w-(--available-width) rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <Calendar
              value={value}
              min={min}
              max={max}
              onValueChange={(next) => {
                onValueChange?.(next)
                setOpen(false)
              }}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { DatePicker }
export type { DatePickerProps }
