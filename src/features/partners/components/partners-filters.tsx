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
import { PARTNER_STATUSES, type PartnerStatus } from "@/features/partners/types";
import type { PartnersSortColumn } from "@/features/partners/schemas/partners-query.schema";

const STATUS_LABEL: Record<PartnerStatus, string> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
};

const ALL_STATUSES_VALUE = "all";

interface PartnersFiltersProps {
  q: string | undefined;
  status: PartnerStatus | undefined;
  sort: PartnersSortColumn;
  order: "asc" | "desc";
}

/**
 * The one Client Component this route needs — everything else (table,
 * pagination) renders from `searchParams` on the server. Reads its
 * current values from props (already parsed server-side by
 * `partners-query.schema.ts`) instead of `useSearchParams()`, which
 * avoids that hook's Suspense-boundary requirement entirely.
 */
export function PartnersFilters({ q, status, sort, order }: PartnersFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(q ?? "");

  function navigate(next: { q?: string; status?: PartnerStatus | "" }) {
    const params = new URLSearchParams();
    const nextQ = "q" in next ? next.q : q;
    const nextStatus = "status" in next ? next.status : status;

    if (nextQ) params.set("q", nextQ);
    if (nextStatus) params.set("status", nextStatus);
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
          placeholder="Search by name or code..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-64"
          aria-label="Search partners"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Select
        value={status ?? ALL_STATUSES_VALUE}
        onValueChange={(value) =>
          navigate({ status: value === ALL_STATUSES_VALUE ? "" : (value as PartnerStatus) })
        }
      >
        <SelectTrigger className="w-40" aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
          {PARTNER_STATUSES.map((partnerStatus) => (
            <SelectItem key={partnerStatus} value={partnerStatus}>
              {STATUS_LABEL[partnerStatus]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
