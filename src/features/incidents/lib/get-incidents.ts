import { createClient } from "@/lib/supabase/server";
import { buildIncidentsQueryFilters } from "@/features/incidents/lib/build-incidents-query-filters";
import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";
import type { IncidentListItem } from "@/features/incidents/types";

export interface GetIncidentsResult {
  incidents: IncidentListItem[];
  total: number;
}

/**
 * One nested select (incident + seat + booking + reporter), never a per-row
 * lookup. Explicit columns: no partner, no resolver, no contact data.
 */
export const INCIDENT_LIST_SELECT =
  "id, type, severity, status, description, created_at, seat:seats(serial_number, status), booking:bookings(booking_number), reporter:users!reported_by(full_name)";

/**
 * Server-only. RLS is the access boundary: admin/ops read every incident, a
 * technician only the ones they reported, a partner user only their own
 * partner's. The filters here are only for the page's search/filter/sort/pagination.
 */
export async function getIncidents(
  query: IncidentsQuery,
): Promise<GetIncidentsResult> {
  const filters = buildIncidentsQueryFilters(query);
  const supabase = await createClient();

  let request = supabase
    .from("incidents")
    .select(INCIDENT_LIST_SELECT, { count: "exact" })
    .order(filters.sort, { ascending: filters.order === "asc" })
    // Unique tie-breaker so ties never repeat or skip rows across pages.
    .order("id", { ascending: true })
    .range(filters.range.from, filters.range.to);

  if (filters.search) {
    request = request.or(filters.search);
  }

  if (filters.status) {
    request = request.eq("status", filters.status);
  }

  if (filters.severity) {
    request = request.eq("severity", filters.severity);
  }

  const { data, error, count } = await request;

  if (error) {
    throw error;
  }

  return {
    incidents: (data ?? []) as unknown as IncidentListItem[],
    total: count ?? 0,
  };
}
