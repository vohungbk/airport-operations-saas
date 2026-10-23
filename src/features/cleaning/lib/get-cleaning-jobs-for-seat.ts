import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

// z.guid(), not z.uuid(): seeded dev ids are not RFC 4122 uuids.
const seatIdSchema = z.guid();

export interface SeatCleaningJob {
  id: string;
  status: "assigned" | "in_progress";
  assigned_at: string;
  booking_number: string;
}

/** Explicit columns: what the choice of a job needs, nothing about price or partner. */
export const SEAT_CLEANING_JOBS_SELECT =
  "id, status, assigned_at, booking:bookings!inner(booking_number, assigned_seat_id)";

interface Row {
  id: string;
  status: "assigned" | "in_progress";
  assigned_at: string;
  booking: { booking_number: string };
}

/**
 * FO-F03-S11 (AC01): the open cleaning jobs of one seat, for the person who scanned its
 * QR code. Server-only, read-only: it never starts or completes anything (AC02).
 * RLS limits the rows: a technician only gets their own jobs, so a seat with none of
 * theirs gives an empty list, the same as an unknown seat. Returns [] for a malformed id.
 */
export async function getCleaningJobsForSeat(
  seatId: string,
): Promise<SeatCleaningJob[]> {
  if (!seatIdSchema.safeParse(seatId).success) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select(SEAT_CLEANING_JOBS_SELECT)
    .eq("job_type", "cleaning")
    .in("status", ["assigned", "in_progress"])
    .eq("booking.assigned_seat_id", seatId)
    .order("assigned_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    status: row.status,
    assigned_at: row.assigned_at,
    booking_number: row.booking.booking_number,
  }));
}
