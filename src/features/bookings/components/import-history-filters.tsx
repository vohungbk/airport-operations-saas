"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_FILTER_VALUE, useImportHistoryFilters } from "@/features/bookings/hooks/use-import-history-filters";
import {
  IMPORT_HISTORY_PERIODS,
  buildImportHistoryHref,
  type ImportHistoryFilters,
} from "@/features/bookings/lib/booking-import-history";

interface Option {
  value: string;
  label: string;
}

interface ImportHistoryFiltersBarProps {
  filters: ImportHistoryFilters;
  partners: Option[];
  actors: Option[];
}

const TRIGGER_CLASS = "h-11 w-full bg-surface px-4 data-[size=default]:h-11 dark:bg-surface";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-56">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** CO-F07-S07 (design "Import history"): Partner, Period and Actor, and Clear filters. Only serializable data crosses in. */
export function ImportHistoryFiltersBar({ filters, partners, actors }: ImportHistoryFiltersBarProps) {
  const { isPending, setPartner, setActor, setPeriod } = useImportHistoryFilters(filters);
  const allPartners = [{ value: ALL_FILTER_VALUE, label: "All partners" }, ...partners];
  const allActors = [{ value: ALL_FILTER_VALUE, label: "All users" }, ...actors];

  return (
    <div
      aria-busy={isPending}
      className="flex flex-wrap items-end gap-3"
    >
      <Field label="Partner">
        <Select value={filters.partner_id ?? ALL_FILTER_VALUE} items={allPartners} onValueChange={setPartner}>
          <SelectTrigger className={TRIGGER_CLASS} aria-label="Partner">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allPartners.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Period">
        <Select value={filters.period} items={IMPORT_HISTORY_PERIODS} onValueChange={setPeriod}>
          <SelectTrigger className={TRIGGER_CLASS} aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IMPORT_HISTORY_PERIODS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Actor">
        <Select value={filters.actor_id ?? ALL_FILTER_VALUE} items={allActors} onValueChange={setActor}>
          <SelectTrigger className={TRIGGER_CLASS} aria-label="Actor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allActors.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Link
        href={buildImportHistoryHref({ period: "30d", page: 1 })}
        className={buttonVariants({ variant: "outline", className: "min-h-11 w-full bg-surface px-4 sm:w-auto dark:bg-surface" })}
      >
        Clear filters
      </Link>
    </div>
  );
}
