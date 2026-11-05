import { createClient } from "@/lib/supabase/server";

import type { FlightSource } from "./provider/flight-source";
import { getFlightSourceConfig, type ConfigSource } from "./provider/provider-config";

export interface ProviderStatus {
  source: FlightSource;
  /** When any flight was last refreshed from its source; null when none ever was. */
  last_synced_at: string | null;
  /**
   * The database does not record provider errors yet (VI-F02-S11 adds that), so this is always
   * null for now.
   */
  last_error: string | null;
}

/**
 * Server-only. The active source comes from configuration, the last sync from `flights`
 * (RLS decides the rows). It never calls the provider and never returns a credential.
 */
export async function getProviderStatus(
  config_source: ConfigSource = process.env,
): Promise<ProviderStatus> {
  const { source } = getFlightSourceConfig(config_source);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("flights")
    .select("last_synced_at")
    .not("last_synced_at", "is", null)
    .order("last_synced_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return { source, last_synced_at: data?.[0]?.last_synced_at ?? null, last_error: null };
}
