"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { JobAirportOption } from "@/features/jobs/types";
import { buildReturnQueueHref } from "@/features/return-queue/lib/build-return-queue-href";
import {
  RETURN_QUEUE_STEPS,
  RETURN_QUEUE_STEP_LABEL,
  type ReturnQueueStep,
} from "@/features/return-queue/lib/return-chain";
import {
  RETURN_QUEUE_SEARCH_MAX_LENGTH,
  type ReturnQueueQuery,
} from "@/features/return-queue/schemas/return-queue-query.schema";

const ALL_VALUE = "all";

const TRIGGER_CLASS =
  "h-11 w-full rounded-lg border-border-input bg-surface px-3 text-sm data-[size=default]:h-11";

interface ReturnQueueFiltersProps {
  query: ReturnQueueQuery;
  airports: JobAirportOption[];
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * The filter card of the design: Search, Current step and Airport. Every
 * change goes back to page 1 and lives in the URL.
 */
export function ReturnQueueFilters({ query, airports }: ReturnQueueFiltersProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query.q ?? "");

  function go(overrides: Partial<ReturnQueueQuery>) {
    router.push(buildReturnQueueHref(query, { ...overrides, page: 1 }));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go({ q: searchInput.trim() || undefined });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <form onSubmit={handleSearchSubmit} role="search" noValidate>
          <Field label="Search" htmlFor="return-queue-search">
            <Input
              id="return-queue-search"
              placeholder="Seat or booking"
              maxLength={RETURN_QUEUE_SEARCH_MAX_LENGTH}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-11 w-full rounded-lg border-border-input bg-surface px-3 text-sm"
            />
          </Field>
        </form>

        <Field label="Current step" htmlFor="return-queue-step-filter">
          <Select
            value={query.step ?? ALL_VALUE}
            items={[
              { value: ALL_VALUE, label: "All steps" },
              ...RETURN_QUEUE_STEPS.map((value) => ({
                value,
                label: RETURN_QUEUE_STEP_LABEL[value],
              })),
            ]}
            onValueChange={(value) =>
              go({
                step:
                  !value || value === ALL_VALUE
                    ? undefined
                    : (value as ReturnQueueStep),
              })
            }
          >
            <SelectTrigger
              id="return-queue-step-filter"
              className={TRIGGER_CLASS}
              aria-label="Filter by current step"
            >
              <SelectValue placeholder="All steps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All steps</SelectItem>
              {RETURN_QUEUE_STEPS.map((step) => (
                <SelectItem key={step} value={step}>
                  {RETURN_QUEUE_STEP_LABEL[step]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Airport" htmlFor="return-queue-airport-filter">
          <Select
            value={query.airport_id ?? ALL_VALUE}
            items={[
              { value: ALL_VALUE, label: "All airports" },
              ...airports.map((airport) => ({
                value: airport.id,
                label: airport.code,
              })),
            ]}
            onValueChange={(value) =>
              go({
                airport_id: !value || value === ALL_VALUE ? undefined : value,
              })
            }
          >
            <SelectTrigger
              id="return-queue-airport-filter"
              className={TRIGGER_CLASS}
              aria-label="Filter by airport"
            >
              <SelectValue placeholder="All airports" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All airports</SelectItem>
              {airports.map((airport) => (
                <SelectItem key={airport.id} value={airport.id}>
                  {airport.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => router.push("/return-queue")}
        className="h-11 w-fit rounded-lg bg-surface px-4"
      >
        Clear filters
      </Button>
    </div>
  );
}
