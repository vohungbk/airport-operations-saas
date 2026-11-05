import type { FlightSource } from "./provider/flight-source";

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
