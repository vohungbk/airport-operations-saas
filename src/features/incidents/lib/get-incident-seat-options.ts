import { createClient } from "@/lib/supabase/server";

export interface IncidentSeatOption {
  id: string;
  serial_number: string;
}

const MAX_OPTIONS = 200;

/**
 * Server-only. Options for the Seat filter. RLS decides which seats the
 * caller can read.
 */
export async function getIncidentSeatOptions(): Promise<IncidentSeatOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seats")
    .select("id, serial_number")
    .order("serial_number", { ascending: true })
    .limit(MAX_OPTIONS);

  if (error) {
    throw error;
  }

  return data ?? [];
}
