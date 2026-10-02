"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="flex items-center gap-2"
      >
        <Input
          placeholder="Search by booking number..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-60"
          aria-label="Search bookings"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Select
        value={airportId ?? ALL_VALUE}
        onValueChange={(value) =>
          navigate({ airport_id: toFilterValue(value) })
        }
      >
        <SelectTrigger className="w-48" aria-label="Filter by airport">
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
        onValueChange={(value) => navigate({ status: toFilterValue(value) })}
      >
        <SelectTrigger className="w-40" aria-label="Filter by status">
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

      <Input
        type="date"
        value={dateFrom ?? ""}
        onChange={(event) => navigate({ date_from: event.target.value })}
        className="w-40"
        aria-label="Pickup date from"
      />
      <Input
        type="date"
        value={dateTo ?? ""}
        onChange={(event) => navigate({ date_to: event.target.value })}
        className="w-40"
        aria-label="Pickup date to"
      />
    </div>
  );
}
