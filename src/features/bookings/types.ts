import type { Database } from "@/types/database.types";

/**
 * Aliases of the generated Supabase row types so they can never drift
 * from the schema (same pattern as `Seat`).
 */
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];

export type BookingStatus = Database["public"]["Enums"]["booking_status"];

export type BookingEvent =
  Database["public"]["Tables"]["booking_events"]["Row"];
