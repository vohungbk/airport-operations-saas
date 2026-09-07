import { createClient } from "@/lib/supabase/server";

export interface AirportRelatedCounts {
  seats: number;
  bookings: number;
  flights: number;
}

/**
 * Server-only. 3 independent `count: "exact", head: true` queries, each
 * filtered by `airport_id` (indexed via `seats_airport_id_idx` and
 * `flights_airport_id_idx`; `bookings.airport_id` has the FK's implicit
 * index). Runs once per detail-page render, not once per row in a list —
 * not an N+1 pattern. Per plan.md's "Quyết định đã chốt" #1, these show
 * real counts (unlike
 * `partner-detail.tsx`'s placeholder), even though Seat Inventory (F09),
 * Booking Management (F11), and Flight Integration (F20) haven't shipped
 * their own feature UIs yet — the tables and columns already exist from
 * F02, and a `0` here is a real fact ("zero seats currently exist"), not
 * a stand-in for "not built."
 */
export async function getAirportRelatedCounts(
  airportId: string,
): Promise<AirportRelatedCounts> {
  const supabase = await createClient();

  const [seatsResult, bookingsResult, flightsResult] = await Promise.all([
    supabase
      .from("seats")
      .select("id", { count: "exact", head: true })
      .eq("airport_id", airportId),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("airport_id", airportId),
    supabase
      .from("flights")
      .select("id", { count: "exact", head: true })
      .eq("airport_id", airportId),
  ]);

  if (seatsResult.error) {
    throw seatsResult.error;
  }
  if (bookingsResult.error) {
    throw bookingsResult.error;
  }
  if (flightsResult.error) {
    throw flightsResult.error;
  }

  return {
    seats: seatsResult.count ?? 0,
    bookings: bookingsResult.count ?? 0,
    flights: flightsResult.count ?? 0,
  };
}
