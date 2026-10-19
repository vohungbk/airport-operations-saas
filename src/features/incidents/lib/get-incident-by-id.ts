import { createClient } from "@/lib/supabase/server";
import { incidentIdSchema } from "@/features/incidents/schemas/incident-id.schema";
import type { IncidentDetailItem } from "@/features/incidents/types";

/**
 * Explicit column list: what the detail screen shows. RLS limits rows, not
 * columns, so this list is what keeps partner contact and commercial data and
 * user emails out of the page.
 */
export const INCIDENT_DETAIL_SELECT = [
  "id",
  "type",
  "severity",
  "status",
  "description",
  "created_at",
  "updated_at",
  "resolved_at",
  "technician_job_id",
  "partner:partners(name)",
  "seat:seats(serial_number)",
  "booking:bookings(booking_number)",
  "reporter:users!reported_by(full_name)",
  "resolver:users!resolved_by(full_name)",
].join(", ");

/**
 * Server-only. Returns `null` for a malformed id, an unknown id, or an
 * incident RLS hides: the caller shows the same forbidden state for all
 * three, so an out-of-scope id looks the same as a missing one.
 */
export async function getIncidentById(
  id: string,
): Promise<IncidentDetailItem | null> {
  if (!incidentIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .select(INCIDENT_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as IncidentDetailItem | null;
}
