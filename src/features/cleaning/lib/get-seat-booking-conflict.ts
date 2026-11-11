import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/features/bookings/types";

/**
 * Same length as `c_cleaning_period` in `public.start_cleaning()`. The database
 * is the authority and refuses the start (`JB009`); this only lets the panel say so
 * before the user presses Start. Change both together.
 */
export const CLEANING_PERIOD_HOURS = 2;

/** Bookings that hold or use a seat, as in `public.start_cleaning()`. */
const HOLDING_STATUSES = [
  "pending",
  "confirmed",
  "assigned",
  "in_progress",
] as const satisfies readonly BookingStatus[];

export interface SeatBookingConflict {
  id: string;
  booking_number: string;
  pickup_at: string;
  return_at: string;
}

/**
 * Server-only. Another booking that holds or uses the seat from now for the
 * cleaning period; `null` when there is none. RLS decides what the caller may read.
 */
export async function getSeatBookingConflict(
  seatId: string,
  ownBookingId: string,
  now: Date = new Date(),
): Promise<SeatBookingConflict | null> {
  const periodEnd = new Date(now.getTime() + CLEANING_PERIOD_HOURS * 3_600_000);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, booking_number, pickup_at, return_at")
    .eq("assigned_seat_id", seatId)
    .neq("id", ownBookingId)
    .in("status", [...HOLDING_STATUSES])
    .lt("pickup_at", periodEnd.toISOString())
    .gt("return_at", now.toISOString())
    .order("pickup_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
