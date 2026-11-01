"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { WORKFLOW_BOARD_ROUTE } from "@/lib/constants/routes";
import { buildWorkflowBoardHref } from "@/features/workflow-board/lib/build-workflow-board-href";
import type { WorkflowBoardOption } from "@/features/workflow-board/lib/resolve-workflow-board-query";
import { validateWorkflowBoardQuery } from "@/features/workflow-board/lib/validate-workflow-board-query";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";

export type FilterField = "partner_id" | "airport_id" | "date" | "q";

export interface FilterChip {
  field: FilterField;
  label: string;
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

/**
 * The state and actions of the filter bar. A change is checked with the schema the server uses
 * (`validateWorkflowBoardQuery`) and only then changes the address; a change closes the booking preview,
 * as the preview belongs to the cards in view.
 */
export function useWorkflowBoardFilters(
  query: WorkflowBoardQuery,
  partners: WorkflowBoardOption[],
  airports: WorkflowBoardOption[],
) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query.q ?? "");
  const [error, setError] = useState<string | null>(null);

  function navigate(change: Partial<Record<FilterField, string>>) {
    const result = validateWorkflowBoardQuery({
      partner_id: query.partner_id,
      airport_id: query.airport_id,
      date: query.date,
      q: query.q,
      ...change,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    router.push(buildWorkflowBoardHref(result.query));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ q: searchInput.trim() });
  }

  function clearFilters() {
    setError(null);
    setSearchInput("");
    router.push(WORKFLOW_BOARD_ROUTE);
  }

  function removeFilter(field: FilterField) {
    if (field === "q") setSearchInput("");
    navigate({ [field]: "" });
  }

  const partnerLabel = partners.find((option) => option.value === query.partner_id)?.label;
  const airportLabel = airports.find((option) => option.value === query.airport_id)?.label;

  const chips: FilterChip[] = [
    ...(partnerLabel ? [{ field: "partner_id" as const, label: partnerLabel }] : []),
    ...(airportLabel ? [{ field: "airport_id" as const, label: airportLabel }] : []),
    ...(query.date ? [{ field: "date" as const, label: formatDay(query.date) }] : []),
    ...(query.q ? [{ field: "q" as const, label: query.q }] : []),
  ];

  return {
    searchInput,
    setSearchInput,
    error,
    chips,
    navigate,
    submitSearch,
    clearFilters,
    removeFilter,
  };
}
