import type { FlightAlertItem } from "@/features/dashboard/lib/get-flight-alerts";
import { getFlightDisruption } from "@/lib/flights/flight-timing";

/** Lower comes first: an early flight, then a flag to replan (cancelled, diverted), then a delay. */
function rank(alert: FlightAlertItem): number {
  if (alert.kind === "early") return 0;
  return getFlightDisruption(alert.kind) !== null ? 1 : 2;
}

/**
 * Pure. The Command Centre order of the flight alerts (VI-F11-S01, R15): early-flight items come first
 * because the installation deadline moves forward and the time to act is shortest. Alerts of the same
 * rank keep the order they came in.
 */
export function sortFlightAlerts(
  alerts: readonly FlightAlertItem[],
): FlightAlertItem[] {
  return alerts
    .map((alert, index) => ({ alert, index }))
    .sort((a, b) => rank(a.alert) - rank(b.alert) || a.index - b.index)
    .map(({ alert }) => alert);
}
