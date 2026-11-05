"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { buildFlightBoardHref } from "@/features/flights/lib/build-flight-board-href";
import type { FlightBoardQuery } from "@/features/flights/schemas/flight-board-query.schema";

export const ALL_STATUSES_VALUE = "all";

/** Moves the Flight board to another address when a filter changes; the page is read again on the server. */
export function useFlightBoardFilters(query: FlightBoardQuery) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(next: Partial<Record<keyof FlightBoardQuery, string | undefined>>) {
    startTransition(() => {
      router.push(buildFlightBoardHref(query, next));
    });
  }

  return {
    isPending,
    setAirport: (value: string | null) => change({ airport_id: value ?? undefined }),
    setStatus: (value: string | null) =>
      change({ status: !value || value === ALL_STATUSES_VALUE ? undefined : value }),
  };
}
