import { z } from "zod";

import { TRACKED_FIELDS, type FlightChange } from "@/features/flights/lib/flight-diff";

/**
 * A row of `flight_updates` as the history card reads it (VI-F02-T01). `changes` is JSON in the
 * database, so it is checked here before anything is shown: a change that is not of this shape is
 * left out, it never reaches the page.
 */
export const FLIGHT_UPDATE_SOURCES = ["provider", "system", "manual"] as const;

export type FlightUpdateSource = (typeof FLIGHT_UPDATE_SOURCES)[number];

/** The id of a flight, as in the database (a UUID that is not always RFC-variant, like the booking id). */
export const flightIdSchema = z.guid();

const flightChangeSchema = z.object({
  field: z.enum(TRACKED_FIELDS),
  from: z.union([z.string(), z.number()]).nullable(),
  to: z.union([z.string(), z.number()]).nullable(),
});

const flightUpdateRowSchema = z.object({
  id: z.string().min(1),
  source: z.enum(FLIGHT_UPDATE_SOURCES),
  occurred_at: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  changes: z.array(z.unknown()),
});

/** One entry of the history: one refresh that changed something. */
export interface FlightUpdateItem {
  id: string;
  source: FlightUpdateSource;
  occurred_at: string;
  changes: FlightChange[];
}

/**
 * The entry for a stored row; `null` when the row is not of the expected shape, or none of its
 * changes is (an entry with nothing to say is not shown).
 */
export function parseFlightUpdateRow(row: unknown): FlightUpdateItem | null {
  const parsed = flightUpdateRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const changes = parsed.data.changes.flatMap((change) => {
    const result = flightChangeSchema.safeParse(change);
    return result.success ? [result.data] : [];
  });

  if (changes.length === 0) return null;

  return {
    id: parsed.data.id,
    source: parsed.data.source,
    occurred_at: parsed.data.occurred_at,
    changes,
  };
}
