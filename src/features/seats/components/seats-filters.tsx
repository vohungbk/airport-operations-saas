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
  SEAT_STATUSES,
  SEAT_STATUS_LABEL,
} from "@/features/seats/lib/seat-status";
import type { SeatsSortColumn } from "@/features/seats/schemas/seats-query.schema";
import type { SeatStatus } from "@/features/seats/types";

const ALL_VALUE = "all";

interface Option {
  value: string;
  label: string;
}

interface SeatsFiltersProps {
  q: string | undefined;
  airportId: string | undefined;
  categoryId: string | undefined;
  status: SeatStatus | undefined;
  sort: SeatsSortColumn;
  order: "asc" | "desc";
  airports: Option[];
  categories: Option[];
}

type FilterKey = "q" | "airport_id" | "category_id" | "status";

/**
 * The one Client Component the list route needs. Reads current values
 * from props (parsed server-side) instead of `useSearchParams()`. Only
 * serializable data crosses the boundary.
 */
export function SeatsFilters({
  q,
  airportId,
  categoryId,
  status,
  sort,
  order,
  airports,
  categories,
}: SeatsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(q ?? "");

  function navigate(change: Partial<Record<FilterKey, string>>) {
    const next: Record<FilterKey, string | undefined> = {
      q,
      airport_id: airportId,
      category_id: categoryId,
      status,
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
          placeholder="Search by serial number or token..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-72"
          aria-label="Search seats"
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
        value={categoryId ?? ALL_VALUE}
        onValueChange={(value) =>
          navigate({ category_id: toFilterValue(value) })
        }
      >
        <SelectTrigger className="w-48" aria-label="Filter by category">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All categories</SelectItem>
          {categories.map((option) => (
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
          {SEAT_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {SEAT_STATUS_LABEL[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
