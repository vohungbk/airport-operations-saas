import { createClient } from "@/lib/supabase/server";
import {
  OPEN_JOB_STATUSES,
  selectTodaysJobs,
  type TodayJobRow,
  type TodaysJobs,
} from "@/features/jobs/lib/todays-jobs";

/**
 * One nested select (job + technician + booking + airport + seat + flight), never a per-row lookup. Explicit columns:
 * RLS limits rows, not columns, so this list keeps pricing, revenue share, the partner and the booking
 * notes out of the page (as `JOB_DETAIL_SELECT` does).
 */
export const TODAYS_JOBS_SELECT = [
  "id",
  "status",
  "vehicle_bay",
  "technician:users!technician_id(full_name)",
  "booking:bookings!inner(booking_number, pickup_at, vehicle, vehicle_bay, airport:airports(code, name, city, timezone), required_category:seat_categories!seat_category_id(name), seat:seats!assigned_seat_id(serial_number), flight:flights(flight_number, terminal, last_synced_at, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, delay_minutes))",
].join(", ");

/**
 * Server-only. The open jobs the viewer's RLS allows (a technician reads only their own), picked and
 * sorted for today by `selectTodaysJobs`. A failed read throws, so the page shows its error state and
 * never an empty list in its place.
 */
export async function getTodaysJobs(now: Date = new Date()): Promise<TodaysJobs> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select(TODAYS_JOBS_SELECT)
    .in("status", [...OPEN_JOB_STATUSES]);

  if (error) {
    throw error;
  }

  return selectTodaysJobs((data ?? []) as unknown as TodayJobRow[], now);
}
