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
/**
 * `withPartner` adds the partner name of the booking, for a manager only: a technician never gets it.
 */
export function buildJobDetailSelect(withPartner: boolean): string {
  const partner = withPartner ? ", partner:partners(name)" : "";

  return [
    "id",
    "job_number",
    "status",
    "job_type",
    "assigned_at",
    "started_at",
    "completed_at",
    "created_at",
    "vehicle_bay",
    "installation_notes",
    "deadline_at",
    "technician:users!technician_id(id, full_name)",
    `booking:bookings!inner(id, booking_number, pickup_at, return_at, vehicle, vehicle_bay, child_age_band, child_height, flight_number, flight_lookup_status, airport:airports(code, name, city, timezone), seat:seats!assigned_seat_id(id, serial_number, status, category:seat_categories(name)), flight:flights(flight_number, status, terminal, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, delay_minutes, last_synced_at, manual_entered_at, manual_reason)${partner})`,
  ].join(", ");
}

export const JOB_DETAIL_SELECT = buildJobDetailSelect(false);

/**
 * Server-only. Returns `null` for a malformed id, an unknown id, or a job
 * RLS hides (another technician's) — the caller turns that into
 * `notFound()`, so an out-of-scope id looks the same as a missing one.
 */
export async function getJobById(
  id: string,
  { withPartner = false }: { withPartner?: boolean } = {},
): Promise<JobDetailItem | null> {
  if (!jobIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select(buildJobDetailSelect(withPartner))
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as JobDetailItem | null;
}
