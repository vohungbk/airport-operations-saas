"use client";

import { useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { CalendarIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatShortMonth } from "@/features/invoices/lib/invoice-list";

interface InvoicesPeriodFieldProps {
  id: string;
  /** `YYYY-MM`, or empty. */
  from: string;
  to: string;
  /** Called once, when the popover closes with a period that is not the one it opened with. */
  onApply: (period: { from: string; to: string }) => void;
}

const monthText = (month: string, empty: string) => (month ? formatShortMonth(`${month}-01`) : empty);

/**
 * The Period field of the design: one box that reads "From month – To month" with a calendar, which opens
 * the two months. The period applies when the box is closed, so the list is not read after each key.
 */
export function InvoicesPeriodField({ id, from, to, onApply }: InvoicesPeriodFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const isEmpty = !from && !to;

  function handleOpenChange(next: boolean) {
    setOpen(next);

    if (next) {
      setDraft({ from, to });
    } else if (draft.from !== from || draft.to !== to) {
      onApply(draft);
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        id={id}
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
          isEmpty && "text-muted-foreground",
        )}
      >
        <span className="min-w-0 truncate">
          {monthText(from, "From month")} – {monthText(to, "To month")}
        </span>
        <CalendarIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={4} className="isolate z-50">
          <PopoverPrimitive.Popup className="flex flex-col gap-3 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <label className="flex flex-col gap-1 text-sm">
              From month
              <Input type="month" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className="h-11" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              To month
              <Input type="month" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className="h-11" />
            </label>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
