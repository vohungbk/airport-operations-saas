import { createClient } from "@/lib/supabase/server";
import type { JobAirportOption } from "@/features/jobs/types";

const MAX_OPTIONS = 200;

/**
 * Server-only. Options for the airport filter. RLS decides which airports the caller can read.
 */
export async function getJobAirportOptions(): Promise<JobAirportOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("airports")
    .select("id, code, timezone")
    .order("code", { ascending: true })
    .limit(MAX_OPTIONS);

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * The zone the date range is read in: the chosen airport's, else the one every airport shares, else UTC.
 * Pure.
 */
export function getJobsTimeZone(airports: JobAirportOption[], airportId: string | undefined): string {
  const chosen = airports.find((airport) => airport.id === airportId);
  if (chosen) return chosen.timezone;

  const zones = new Set(airports.map((airport) => airport.timezone));

  return zones.size === 1 ? [...zones][0] : "UTC";
}
