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
  SEAT_CATEGORY_STATUSES,
  type SeatCategoriesSortColumn,
  type SeatCategoryStatusFilter,
} from "@/features/seat-categories/schemas/seat-categories-query.schema";

const STATUS_LABEL: Record<SeatCategoryStatusFilter, string> = {
  active: "Active",
  inactive: "Inactive",
};

const ALL_STATUSES_VALUE = "all";

interface SeatCategoriesFiltersProps {
  q: string | undefined;
  status: SeatCategoryStatusFilter | undefined;
  sort: SeatCategoriesSortColumn;
  order: "asc" | "desc";
}

/**
 * The one Client Component this route needs. Reads current values from
 * props (parsed server-side) instead of `useSearchParams()`.
 */
export function SeatCategoriesFilters({
  q,
  status,
  sort,
  order,
}: SeatCategoriesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(q ?? "");

  function navigate(next: {
    q?: string;
    status?: SeatCategoryStatusFilter | "";
  }) {
    const params = new URLSearchParams();
    const nextQ = "q" in next ? next.q : q;
    const nextStatus = "status" in next ? next.status : status;

    if (nextQ) params.set("q", nextQ);
    if (nextStatus) params.set("status", nextStatus);
    params.set("sort", sort);
    params.set("order", order);
    // Any filter change resets pagination back to page 1.

    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ q: searchInput.trim() });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="flex items-center gap-2"
      >
        <Input
          placeholder="Search by name or safety standard..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-72"
          aria-label="Search seat categories"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Select
        value={status ?? ALL_STATUSES_VALUE}
        onValueChange={(value) =>
          navigate({
            status:
              value === ALL_STATUSES_VALUE
                ? ""
                : (value as SeatCategoryStatusFilter),
          })
        }
      >
        <SelectTrigger className="w-40" aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
          {SEAT_CATEGORY_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {STATUS_LABEL[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
