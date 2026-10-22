"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by name or email..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="min-w-0 flex-1 sm:w-64 sm:flex-none"
          aria-label="Search technicians"
          aria-invalid={searchError !== null}
          aria-describedby={searchError ? "technician-search-error" : undefined}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </div>
      {searchError && (
        <p
          id="technician-search-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {searchError}
        </p>
      )}
    </form>
  );
}
