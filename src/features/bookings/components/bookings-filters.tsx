"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DatePicker } from "@/components/ui/date-picker";
import { SearchInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextLink } from "@/components/ui/text-link";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABEL,
} from "@/features/bookings/lib/booking-status";
import type { BookingsSortColumn } from "@/features/bookings/schemas/bookings-query.schema";
import type { BookingStatus } from "@/features/bookings/types";

const ALL_VALUE = "all";

interface Option {
  value: string;
  label: string;
}

interface BookingsFiltersProps {
  q: string | undefined;
  airportId: string | undefined;
  status: BookingStatus | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  sort: BookingsSortColumn;
  order: "asc" | "desc";
  airports: Option[];
}

type FilterKey = "q" | "airport_id" | "status" | "date_from" | "date_to";

/**
 * The one Client Component the list route needs. Reads current values
 * from props (parsed server-side) instead of `useSearchParams()`. Only
 * serializable data crosses the boundary.
 */
export function BookingsFilters({
  q,
  airportId,
  status,
  dateFrom,
  dateTo,
  sort,
  order,
  airports,
}: BookingsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(q ?? "");

  function navigate(change: Partial<Record<FilterKey, string>>) {
    const next: Record<FilterKey, string | undefined> = {
      q,
      airport_id: airportId,
      status,
      date_from: dateFrom,
      date_to: dateTo,
      ...change,
    };
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }

    params.set("sort", sort);
    params.set("order", order);
    // Any filter change resets pagination back to page 1.

    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ q: searchInput.trim() });
  }

  function toFilterValue(value: string | null): string {
    return !value || value === ALL_VALUE ? "" : value;
  }

  const hasFilters = Boolean(q || airportId || status || dateFrom || dateTo);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="flex w-full items-center gap-2 sm:w-70"
      >
        <SearchInput
          placeholder="Search booking number…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="h-11"
          aria-label="Search bookings"
        />
      </form>

      <Select
        value={airportId ?? ALL_VALUE}
        items={[{ value: ALL_VALUE, label: "All airports" }, ...airports]}
        onValueChange={(value) =>
          navigate({ airport_id: toFilterValue(value) })
        }
      >
        <SelectTrigger
          className="h-11 w-full flex-row-reverse justify-end gap-2 bg-card px-4 font-medium data-[size=default]:h-11 sm:w-fit"
          aria-label="Filter by airport"
        >
          <SelectValue placeholder="All airports" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All airports</SelectItem>
          {airports.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={status ?? ALL_VALUE}
        items={[
          { value: ALL_VALUE, label: "All statuses" },
          ...BOOKING_STATUSES.map((value) => ({
            value,
            label: BOOKING_STATUS_LABEL[value],
          })),
        ]}
        onValueChange={(value) => navigate({ status: toFilterValue(value) })}
      >
        <SelectTrigger
          className="h-11 w-full flex-row-reverse justify-end gap-2 bg-card px-4 font-medium data-[size=default]:h-11 sm:w-fit"
          aria-label="Filter by status"
        >
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
          {BOOKING_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {BOOKING_STATUS_LABEL[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DatePicker
        value={dateFrom}
        onValueChange={(value) => navigate({ date_from: value })}
        placeholder="Pickup from"
        className="h-11 w-full bg-card px-4 sm:w-40"
      />
      <DatePicker
        value={dateTo}
        onValueChange={(value) => navigate({ date_to: value })}
        placeholder="Pickup to"
        className="h-11 w-full bg-card px-4 sm:w-40"
      />
      {hasFilters && (
        <TextLink
          href={`${pathname}?sort=${sort}&order=${order}`}
          className="text-muted-foreground"
        >
          Clear all
        </TextLink>
      )}
    </div>
  );
}
