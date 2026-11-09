"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { buildTechniciansHref } from "@/features/technicians/lib/build-technicians-href";
import { getTechnicianSearchError } from "@/features/technicians/lib/technician-search";
import type { TechniciansQuery } from "@/features/technicians/schemas/technicians-query.schema";

interface TechniciansFiltersProps {
  query: TechniciansQuery;
}

/**
 * The one Client Component this route needs. Validates the search value
 * with the same rule the server uses, so an over-long value shows an
 * error here instead of navigating.
 */
export function TechniciansFilters({ query }: TechniciansFiltersProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query.q ?? "");
  const [searchError, setSearchError] = useState<string | null>(null);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error = getTechnicianSearchError(searchInput);
    setSearchError(error);

    if (error) {
      return;
    }

    router.push(
      buildTechniciansHref(query, { q: searchInput.trim() || undefined, page: 1 }),
    );
  }

  return (
    <form
      onSubmit={handleSearchSubmit}
      noValidate
      className="flex flex-col gap-2"
    >
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-3 -translate-y-1/2 text-text-muted"
        />
        <Input
          placeholder="Search technicians..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="h-11 w-full rounded-lg border-border-input bg-surface pr-2 pl-9 text-sm sm:w-[204px]"
          aria-label="Search technicians"
          aria-invalid={searchError !== null}
          aria-describedby={searchError ? "technician-search-error" : undefined}
        />
      </div>
      {searchError && (
        <p
          id="technician-search-error"
          role="alert"
          className="text-sm text-danger-fg"
        >
          {searchError}
        </p>
      )}
    </form>
  );
}
