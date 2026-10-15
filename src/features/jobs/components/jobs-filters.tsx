"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildJobsHref } from "@/features/jobs/lib/build-jobs-href";
import { getJobSearchError } from "@/features/jobs/lib/job-search";
import {
  JOB_STATUSES,
  JOB_STATUS_LABEL,
  type JobStatus,
} from "@/features/jobs/lib/job-status";
import type { JobsQuery } from "@/features/jobs/schemas/jobs-query.schema";
import type { TechnicianOption } from "@/features/jobs/types";

const ALL_VALUE = "all";

interface JobsFiltersProps {
  query: JobsQuery;
  /** `null` hides the technician filter (a technician sees only their own jobs). */
  technicians: TechnicianOption[] | null;
}

/**
 * The one Client Component this route needs. Search is validated with
 * the same rule the server uses; filter changes reset to page 1.
 */
export function JobsFilters({ query, technicians }: JobsFiltersProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query.q ?? "");
  const [searchError, setSearchError] = useState<string | null>(null);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error = getJobSearchError(searchInput);
    setSearchError(error);

    if (error) {
      return;
    }

    router.push(
      buildJobsHref(query, { q: searchInput.trim() || undefined, page: 1 }),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          noValidate
          className="flex items-center gap-2"
        >
          <Input
            placeholder="Search by booking number..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-60"
            aria-label="Search jobs"
            aria-invalid={searchError !== null}
            aria-describedby={searchError ? "job-search-error" : undefined}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <Select
          value={query.status ?? ALL_VALUE}
          onValueChange={(value) =>
            router.push(
              buildJobsHref(query, {
                status:
                  !value || value === ALL_VALUE
                    ? undefined
                    : (value as JobStatus),
                page: 1,
              }),
            )
          }
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            {JOB_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {JOB_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {technicians && (
          <Select
            value={query.technician_id ?? ALL_VALUE}
            onValueChange={(value) =>
              router.push(
                buildJobsHref(query, {
                  technician_id:
                    !value || value === ALL_VALUE ? undefined : value,
                  page: 1,
                }),
              )
            }
          >
            <SelectTrigger className="w-48" aria-label="Filter by technician">
              <SelectValue placeholder="All technicians" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All technicians</SelectItem>
              {technicians.map((technician) => (
                <SelectItem key={technician.id} value={technician.id}>
                  {technician.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {searchError && (
        <p id="job-search-error" role="alert" className="text-sm text-destructive">
          {searchError}
        </p>
      )}
    </div>
  );
}
