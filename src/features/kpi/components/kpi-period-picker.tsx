"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKpiPeriodPicker } from "@/features/kpi/hooks/use-kpi-period-picker";
import type { KpiPeriodOption } from "@/lib/kpi/kpi-period";

interface KpiPeriodPickerProps {
  /** `current`, `ytd` or `YYYY-MM`, as the page resolved it. */
  selected: string;
  /** The periods the dropdown offers; none of them is in the future. */
  options: readonly KpiPeriodOption[];
  /** The period the figures are compared with, as a name ("September 2026"); `null` when there is none to offer. */
  compare_label: string | null;
  /** Whether the comparison is on. */
  compare_on: boolean;
  /** The search of the address, as it was validated. */
  query: string;
}

// The same 44 px as the search box and the button. The Select trigger sets its own height through
// `data-[size=default]`, which beats a plain `h-11`, so the height is set the same way here.
const TRIGGER_CLASS =
  "h-11 w-full flex-row-reverse justify-end gap-2 rounded-md border-border bg-card px-4 font-medium data-[size=default]:h-11 sm:w-fit";

/**
 * The bar of the KPI dashboard as the design draws it (VI-F05-S01, F1): the search box, a dropdown with the
 * current month, year to date or a month, a dropdown for the comparison, and Clear all, which empties the
 * search and goes back to the current month with the comparison on.
 */
export function KpiPeriodPicker({ selected, options, compare_label, compare_on, query }: KpiPeriodPickerProps) {
  const { error, choose, chooseCompare, search, clear } = useKpiPeriodPicker();
  const [text, setText] = useState(query);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    search(text);
  }

  function clearAll() {
    setText("");
    clear();
  }

  const compareItems = [
    { value: "on", label: `Compare ${compare_label ?? ""}`.trim() },
    { value: "off", label: "No comparison" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} role="search" className="flex w-full items-center sm:w-70">
          <SearchInput
            placeholder="Search records…"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="h-11 rounded-md bg-card"
            aria-label="Search KPIs"
            maxLength={80}
          />
        </form>
        <Select value={selected} items={options as KpiPeriodOption[]} onValueChange={(value) => value && choose(value)}>
          <SelectTrigger aria-label="Period" aria-invalid={error !== null} className={TRIGGER_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {compare_label !== null && (
          <Select
            value={compare_on ? "on" : "off"}
            items={compareItems}
            onValueChange={(value) => value && chooseCompare(value)}
          >
            <SelectTrigger aria-label="Comparison" className={TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {compareItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="ghost" className="min-h-11 text-muted-foreground" onClick={clearAll}>
          Clear all
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
