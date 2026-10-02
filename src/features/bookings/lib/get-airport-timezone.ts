import type { PostgrestError } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AirportTimezoneResult =
  | { timezone: string | null; error?: undefined }
  | { timezone?: undefined; error: PostgrestError };

/** `timezone: null` when the airport does not exist (or RLS hides it). */
export async function getAirportTimezone(
  supabase: ServerSupabaseClient,
  airportId: string,
): Promise<AirportTimezoneResult> {
  const { data, error } = await supabase
    .from("airports")
    .select("timezone")
    .eq("id", airportId)
    .maybeSingle();

  if (error) {
    return { error };
  }

  return { timezone: data?.timezone ?? null };
}
