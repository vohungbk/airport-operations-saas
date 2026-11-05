import { createClient } from "@/lib/supabase/server";
import {
  flightIdSchema,
  parseFlightUpdateRow,
  type FlightUpdateItem,
} from "@/features/flights/schemas/flight-update.schema";

export const FLIGHT_UPDATES_LIMIT = 100;

/** What the history card shows: the entries, newest first, or that they could not be read. */
export interface FlightUpdatesResult {
  items: FlightUpdateItem[];
  error: boolean;
}

/**
 * Server-only, read-only, newest first. RLS decides which rows the viewer sees (a partner user: its own
 * bookings' flights). It never throws: a failure is part of the result, so the Flight tab can show the
 * error in the history card and still show the flight card (VI-F02-T01 AC05). `null` when the booking
 * has no linked flight: there is no card to show.
 */
export async function getFlightUpdates(
  flightId: string | null | undefined,
): Promise<FlightUpdatesResult | null> {
  if (!flightId) return null;
  if (!flightIdSchema.safeParse(flightId).success) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("flight_updates")
      .select("id, source, changes, occurred_at")
      .eq("flight_id", flightId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(FLIGHT_UPDATES_LIMIT);

    if (error) return { items: [], error: true };

    const items = (data ?? []).flatMap((row) => {
      const item = parseFlightUpdateRow(row);
      return item ? [item] : [];
    });

    return { items, error: false };
  } catch {
    return { items: [], error: true };
  }
}
