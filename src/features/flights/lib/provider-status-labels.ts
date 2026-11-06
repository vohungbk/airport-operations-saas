import type { FlightSource } from "./provider/flight-source";
import type { ProviderErrorKind } from "./provider/provider-error";

export const FLIGHT_SOURCE_LABELS: Record<FlightSource, string> = {
  provider: "Live provider",
  sandbox: "Sandbox",
  simulator: "Simulator",
};

/** The last sync as text for the screen (UTC); "Never synced" when no flight was refreshed. */
export function formatLastSync(last_synced_at: string | null): string {
  const time = last_synced_at ? Date.parse(last_synced_at) : Number.NaN;

  if (Number.isNaN(time)) {
    return "Never synced";
  }

  return `${new Date(time).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export const PROVIDER_ERROR_LABELS: Record<ProviderErrorKind, string> = {
  timeout: "Timed out",
  rate_limited: "Rate limited",
  unavailable: "Unavailable",
  invalid_response: "Unexpected answer",
};

/** The last error as text for the screen: `Rate limited · 2026-12-01 10:05 UTC`. */
export function formatLastError(kind: string, at: string): string {
  const label = kind in PROVIDER_ERROR_LABELS ? PROVIDER_ERROR_LABELS[kind as ProviderErrorKind] : "Unknown error";

  return `${label} · ${formatLastSync(at)}`;
}
