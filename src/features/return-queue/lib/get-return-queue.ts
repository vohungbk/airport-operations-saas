import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { RETURN_CHAIN_BOOKING_STATUSES } from "@/features/return-queue/lib/return-chain";
import {
  toReturnQueueItem,
  type ReturnQueueBookingRow,
  type ReturnQueueItem,
} from "@/features/return-queue/lib/return-queue";

/**
 * One nested select: the booking, its airport, partner, assigned seat, status
 * events and recorded chain steps. Explicit columns: no commercial or contact data.
 */
export const RETURN_QUEUE_SELECT =
  "id, booking_number, status, airport:airports(code, timezone), partner:partners(name), seat:seats!assigned_seat_id(id, serial_number, status), events:booking_events(to_status, created_at), chain_steps:return_chain_steps(step, result, completed_at)";

/** The queue holds the seats being turned around, never the whole history. */
export const RETURN_QUEUE_MAX_ROWS = 500;

/**
 * Server-only. Every booking in the chain the caller can read: RLS is the
 * tenant boundary. The airport filter narrows the query; search, step and
 * paging work on these rows.
 */
export async function getReturnQueue(
  airportId: string | undefined,
  now: Date,
): Promise<ReturnQueueItem[]> {
  const supabase = await createClient();

  let request = supabase
    .from("bookings")
    .select(RETURN_QUEUE_SELECT)
    .in("status", RETURN_CHAIN_BOOKING_STATUSES)
    .order("id", { ascending: true })
    .limit(RETURN_QUEUE_MAX_ROWS);

  if (airportId) {
    request = request.eq("airport_id", airportId);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as ReturnQueueBookingRow[]).map((row) =>
    toReturnQueueItem(row, now),
  );
}

/**
 * Server-only. One booking in the chain, or `null` for a malformed or unknown
 * id, a booking RLS hides, or a booking that is not in the chain.
 */
export async function getReturnChainItem(
  bookingId: string,
  now: Date,
): Promise<ReturnQueueItem | null> {
  if (!z.guid().safeParse(bookingId).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(RETURN_QUEUE_SELECT)
    .eq("id", bookingId)
    .in("status", RETURN_CHAIN_BOOKING_STATUSES)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? toReturnQueueItem(data as unknown as ReturnQueueBookingRow, now)
    : null;
}

/**
 * Server-only. The booking whose return chain holds the seat, for the link
 * from the seat page (reached by a QR scan); null when there is none or RLS
 * hides it.
 */
export async function getReturnChainBookingIdForSeat(
  seatId: string,
): Promise<string | null> {
  if (!z.guid().safeParse(seatId).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("assigned_seat_id", seatId)
    .in("status", RETURN_CHAIN_BOOKING_STATUSES)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}
