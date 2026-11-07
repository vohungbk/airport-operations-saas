"use client";

import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { KpiFormulaHelp } from "@/features/kpi/lib/kpi-formula-help";

interface KpiFormulaPopoverProps {
  help: KpiFormulaHelp;
  /** The name of the KPI, for the name of the button. */
  label: string;
}

/**
 * The formula popover of a KPI tile (VI-F05-S03, R3), as the design draws it: the title with a close
 * button, the equation, the note, and for a rate the numbers of the period. The button covers the whole
 * tile, so the tile opens it; it sits in the tile and does not change the tile.
 */
export function KpiFormulaPopover({ help, label }: KpiFormulaPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`How ${label} is calculated`}
        className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <PopoverContent className="flex w-[420px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        <div className="flex items-center gap-3">
          <PopoverTitle className="flex-1">{help.title}</PopoverTitle>
          <PopoverClose
            aria-label="Close"
            className="flex size-6 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-muted-foreground"
          >
            ×
          </PopoverClose>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-foreground">{help.equation}</p>
          <p className="text-sm text-muted-foreground">{help.note}</p>
          <p className="text-sm text-muted-foreground">{help.source}</p>
        </div>
        {help.row && (
          <dl className="flex items-start gap-3 text-sm">
            <dt className="flex-1 text-muted-foreground">{help.row.label}</dt>
            <dd className="flex-1 text-right text-foreground">{help.row.value}</dd>
          </dl>
        )}
      </PopoverContent>
    </Popover>
  );
}
