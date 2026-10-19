"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildIncidentsHref } from "@/features/incidents/lib/build-incidents-href";
import { getIncidentSearchError } from "@/features/incidents/lib/incident-search";
import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

interface IncidentsSearchProps {
  query: IncidentsQuery;
}

/**
 * The one Client Component this route needs. Search is validated with the
 * same rule the server uses; a new search goes back to page 1.
 */
export function IncidentsSearch({ query }: IncidentsSearchProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query.q ?? "");
  const [searchError, setSearchError] = useState<string | null>(null);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error = getIncidentSearchError(searchInput);
    setSearchError(error);

    if (error) {
      return;
    }

    router.push(
      buildIncidentsHref(query, { q: searchInput.trim() || undefined, page: 1 }),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        noValidate
        className="flex items-center gap-2"
      >
        <Input
          placeholder="Search by type or description..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-72"
          aria-label="Search incidents"
          aria-invalid={searchError !== null}
          aria-describedby={searchError ? "incident-search-error" : undefined}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {searchError && (
        <p
          id="incident-search-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {searchError}
        </p>
      )}
    </div>
  );
}
