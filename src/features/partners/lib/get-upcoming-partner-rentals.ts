import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";

export interface UpcomingPartnerRental {
  id: string;
  booking_number: string;
  pickup_at: string;
  status: string;
  timezone: string;
  seat_serial: string | null;
}

export const UPCOMING_RENTALS_LIMIT = 5;

/** The bookings that have not started: the upcoming rentals and the upcoming reservations count these. */
export const NOT_STARTED_BOOKING_STATUSES = ACTIVE_BOOKING_STATUSES.filter(
  (status) => status !== "in_progress",
);

/** The select is a runtime string, like the bookings list, so the nested relations are cast below. */
const UPCOMING_RENTALS_SELECT =
  "id, booking_number, pickup_at, status, airport:airports(timezone), seat:seats(serial_number)";

interface UpcomingRentalRow {
  id: string;
  booking_number: string;
  pickup_at: string;
  status: string;
  airport: { timezone: string } | null;
  seat: { serial_number: string } | null;
}

/**
 * Server-only. The next bookings of the partner of the signed-in user that have not started, soonest
 * first. The scope is never taken from the caller: RLS gives a partner user only the bookings of its own
 * partner. `null` when it could not be read.
 */
export async function getUpcomingPartnerRentals(
  now: Date = new Date(),
): Promise<UpcomingPartnerRental[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bookings")
      .select(UPCOMING_RENTALS_SELECT)
      .gte("pickup_at", now.toISOString())
      .in("status", NOT_STARTED_BOOKING_STATUSES)
      .order("pickup_at", { ascending: true })
      .limit(UPCOMING_RENTALS_LIMIT);

    if (error || !data) return null;

    return (data as unknown as UpcomingRentalRow[]).map((booking) => ({
      id: booking.id,
      booking_number: booking.booking_number,
      pickup_at: booking.pickup_at,
      status: booking.status,
      timezone: booking.airport?.timezone ?? "UTC",
      seat_serial: booking.seat?.serial_number ?? null,
    }));
  } catch {
    return null;
  }
}
