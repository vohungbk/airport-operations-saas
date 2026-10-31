"use client";

import { Button } from "@/components/ui/button";
import type { PeriodOption } from "@/features/invoices/lib/invoice-periods";

interface InvoicePeriodsListProps {
  options: readonly PeriodOption[];
  /** The month chosen, `YYYY-MM`. */
  month: string;
  disabled: boolean;
  onSelect: (month: string) => void;
}

/** "Available settlement periods" of the design: each month, which can be chosen and which cannot, and why. */
export function InvoicePeriodsList({ options, month, disabled, onSelect }: InvoicePeriodsListProps) {
  return (
    <section aria-labelledby="available-periods" className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <h3 id="available-periods" className="text-sm font-semibold text-foreground">
        Available settlement periods
      </h3>
      <ul className="flex flex-col gap-2">
        {options.map((option) => (
          <li key={option.month} className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-48 px-4"
              disabled={disabled || !option.selectable}
              aria-pressed={option.month === month}
              onClick={() => onSelect(option.month)}
            >
              {option.label}
            </Button>
            <span className="text-sm text-muted-foreground">{option.caption}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
