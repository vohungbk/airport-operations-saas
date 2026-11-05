import type { FlightBoardQuery } from "@/features/flights/schemas/flight-board-query.schema";

/** The address of the Flight board with a change to its filters; a filter set to `undefined` is left out. */
export function buildFlightBoardHref(
  query: FlightBoardQuery,
  change: Partial<Record<keyof FlightBoardQuery, string | undefined>> = {},
): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();

  if (next.airport_id) params.set("airport_id", next.airport_id);
  if (next.status) params.set("status", next.status);

  const search = params.toString();

  return search ? `/flights?${search}` : "/flights";
}
