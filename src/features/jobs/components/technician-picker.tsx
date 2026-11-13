"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { ChevronDownIcon, SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { getTechnicianInitials } from "@/features/technicians/lib/get-technician-initials";
import type { TechnicianOption } from "@/features/jobs/lib/get-job-form-options";

interface TechnicianPickerProps {
  id: string;
  technicians: TechnicianOption[];
  /** The chosen technician id, or an empty string. */
  value: string;
  onChange: (technicianId: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

const TRIGGER_CLASS =
  "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border-input bg-surface px-3 py-1.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

function Avatar({ name, muted }: { name: string; muted: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold",
        muted && "opacity-50",
      )}
    >
      {getTechnicianInitials(name)}
    </span>
  );
}

/**
 * Technician dropdown of Create job and Edit job: a search box and, for each
 * technician, the initials, name, airport and an Active badge. A deactivated
 * technician is listed last, greyed out, and cannot be chosen.
 */
export function TechnicianPicker({
  id,
  technicians,
  value,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
}: TechnicianPickerProps) {
  const selected = technicians.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={technicians}
      value={selected}
      onValueChange={(option) => onChange(option?.value ?? "")}
      isItemEqualToValue={(a, b) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxPrimitive.Trigger
        id={id}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={TRIGGER_CLASS}
      >
        <span
          className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}
        >
          {selected ? selected.label : "Select technician"}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent className="min-w-72">
        <div className="relative p-2">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <ComboboxPrimitive.Input
            aria-label="Search technicians"
            placeholder="Search technicians..."
            className="h-11 w-full min-w-0 rounded-lg border border-border-input bg-surface py-1.5 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <ComboboxEmpty>No technicians found.</ComboboxEmpty>
        <ComboboxList>
          {(option: TechnicianOption) => (
            <ComboboxItem
              key={option.value}
              value={option}
              disabled={!option.is_active}
              showIndicator={false}
              className="gap-3 px-2 py-2 pr-3"
            >
              <span className="flex items-center gap-3">
                <Avatar name={option.label} muted={!option.is_active} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {option.label}
                  </span>
                  <span className="truncate text-xs text-text-muted">
                    {option.is_active
                      ? ["Airport operations", option.airport_code]
                          .filter(Boolean)
                          .join(" · ")
                      : "Unavailable for assignment"}
                  </span>
                </span>
                <Badge variant={option.is_active ? "success" : "muted"}>
                  {option.is_active ? "Active" : "Deactivated"}
                </Badge>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
