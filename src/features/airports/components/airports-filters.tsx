"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AirportsSortColumn } from "@/features/airports/schemas/airports-query.schema";

interface AirportsFiltersProps {
  q: string | undefined;
  sort: AirportsSortColumn;
  order: "asc" | "desc";
}

/**
 * The one Client Component this route needs — everything else (table,
 * pagination) renders from `searchParams` on the server. Reads its
 * current values from props (already parsed server-side by
 * `airports-query.schema.ts`) instead of `useSearchParams()`, which
 * avoids that hook's Suspense-boundary requirement entirely. No status
 * `Select` — `airports` has no status column, unlike `partners-filters.tsx`.
 */
export function AirportsFilters({ q, sort, order }: AirportsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(q ?? "");

  function navigate(next: { q?: string }) {
    const params = new URLSearchParams();
    const nextQ = "q" in next ? next.q : q;

    if (nextQ) params.set("q", nextQ);
    if (sort) params.set("sort", sort);
    if (order) params.set("order", order);
    // Any filter change resets pagination back to page 1.

    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ q: searchInput.trim() });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <Input
          placeholder="Search by code, name, or city..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-64"
          aria-label="Search airports"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
    </div>
  );
}
