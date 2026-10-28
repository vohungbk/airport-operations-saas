import { CircleAlertIcon, ClockIcon } from "lucide-react";

import type { FlightAlertItem } from "@/features/dashboard/lib/get-flight-alerts";
import { cn } from "@/lib/utils";

interface FlightBannersProps {
  alerts: readonly FlightAlertItem[];
}

function unit(minutes: number): string {
  return minutes === 1 ? "MINUTE" : "MINUTES";
}

/**
 * The banners of the design (UI-F06-S04): blue for a flight that arrives early, amber for one that is late.
 * The line under the title has what is stored: the flight, its new arrival and a linked booking. The
 * installation deadline and the technicians notified are not stored, so they are not written.
 */
export function FlightBanners({ alerts }: FlightBannersProps) {
  if (alerts.length === 0) return null;

  return (
    <ul aria-label="Flight alerts" className="flex flex-col gap-3">
      {alerts.map((alert) => {
        const early = alert.kind === "early";
        const Icon = early ? CircleAlertIcon : ClockIcon;
        const parts = [
          alert.flight_number,
          `${early ? "New arrival" : "Arrival"} ${alert.arrival_label}`,
        ];
        if (alert.booking_number) parts.push(alert.booking_number);

        return (
          <li
            key={alert.id}
            data-kind={alert.kind}
            className={cn(
              "flex min-w-0 items-start gap-3 rounded-lg p-4 text-sm",
              early
                ? "bg-info-bg text-info-fg"
                : "bg-warning-bg text-warning-fg",
            )}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold break-words">
                {early
                  ? `ARRIVING ${alert.minutes} ${unit(alert.minutes)} EARLY`
                  : `DELAYED ${alert.minutes} ${unit(alert.minutes)}`}
              </p>
              <p className="break-words">{parts.join(" · ")}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
