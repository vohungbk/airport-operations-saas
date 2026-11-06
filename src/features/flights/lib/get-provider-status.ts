import { createClient } from "@/lib/supabase/server";

import type { FlightSource } from "./provider/flight-source";
import { formatLastError } from "./provider-status-labels";
import { getFlightSourceConfig, type ConfigSource } from "./provider/provider-config";

export interface ProviderStatus {
  source: FlightSource;
  /** When any flight was last refreshed from its source; null when none ever was. */
  last_synced_at: string | null;
  /** The last error of the active source as text (kind and time); null when it never failed. */
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

  const [synced, failed] = await Promise.all([
    supabase
      .from("flights")
      .select("last_synced_at")
      .not("last_synced_at", "is", null)
      .order("last_synced_at", { ascending: false })
      .limit(1),
    supabase.from("flight_provider_status").select("last_error_kind, last_error_at").eq("source", source).maybeSingle(),
  ]);

  if (synced.error) {
    throw synced.error;
  }

  if (failed.error) {
    throw failed.error;
  }

  return {
    source,
    last_synced_at: synced.data?.[0]?.last_synced_at ?? null,
    last_error: failed.data ? formatLastError(failed.data.last_error_kind, failed.data.last_error_at) : null,
  };
}
