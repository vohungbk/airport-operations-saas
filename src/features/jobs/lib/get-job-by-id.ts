import { createClient } from "@/lib/supabase/server";
import { jobIdSchema } from "@/features/jobs/schemas/jobs-query.schema";
import type { JobDetailItem } from "@/features/jobs/types";

/**
 * Explicit column list — the minimum a technician needs to perform the
 * job. Deliberately absent: `daily_rate`, `paid_days`, `gross_revenue`,
 * `partner_share`, `platform_share`, `partner_id`,
 * `external_booking_number` and booking `notes`. RLS limits rows, not
 * columns, so this list is what keeps that data out of the page.
 */
export const JOB_DETAIL_SELECT = [
  "id",
  "status",
  "assigned_at",
  "started_at",
  "completed_at",
  "vehicle_bay",
  "installation_notes",
  "technician:users!technician_id(id, full_name)",
  "booking:bookings!inner(booking_number, pickup_at, return_at, vehicle, vehicle_bay, child_age_band, child_height, airport:airports(code, name), seat:seats!assigned_seat_id(serial_number, category:seat_categories(name)))",
].join(", ");

/**
 * Server-only. Returns `null` for a malformed id, an unknown id, or a job
 * RLS hides (another technician's) — the caller turns that into
 * `notFound()`, so an out-of-scope id looks the same as a missing one.
 */
export async function getJobById(id: string): Promise<JobDetailItem | null> {
  if (!jobIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select(JOB_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as JobDetailItem | null;
}
