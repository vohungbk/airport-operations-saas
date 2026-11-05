import { CircleCheckIcon, CircleDotIcon } from "lucide-react";

import { PageEmpty } from "@/components/shared/page-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  formatUpdateDetail,
  formatUpdateHeadline,
} from "@/features/flights/lib/flight-update-format";
import type { FlightUpdatesResult } from "@/features/flights/lib/get-flight-updates";

export const FLIGHT_UPDATES_EMPTY_MESSAGE = "No flight updates yet.";
export const FLIGHT_UPDATES_ERROR_MESSAGE = "The flight update history could not be loaded. Please try again.";

interface FlightUpdateHistoryProps {
  result: FlightUpdatesResult;
  /** The time zone of the booking's airport; every time is shown in it. */
  timeZone: string;
}

/**
 * The "Flight update history" card of the Flight tab (VI-F02-T01), laid out as the design draws it:
 * a card under the flight card, and one row per change with its time, its source and what changed,
 * newest first. It is read only: there is no action on a row. A history that cannot be read says so
 * here and leaves the flight card alone.
 */
export function FlightUpdateHistory({ result, timeZone }: FlightUpdateHistoryProps) {
  return (
    <section
      aria-labelledby="flight-update-history"
      data-slot="flight-update-history"
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5"
    >
      <h2
        id="flight-update-history"
        className="text-base font-semibold break-words text-foreground"
      >
        Flight update history
      </h2>

      {result.error ? (
        <Alert variant="destructive">
          <AlertDescription>{FLIGHT_UPDATES_ERROR_MESSAGE}</AlertDescription>
        </Alert>
      ) : result.items.length === 0 ? (
        <PageEmpty message={FLIGHT_UPDATES_EMPTY_MESSAGE} />
      ) : (
        <ol data-slot="flight-update-list" className="flex min-w-0 flex-col gap-5">
          {result.items.map((update, index) => {
            const Icon = index === 0 ? CircleDotIcon : CircleCheckIcon;

            return (
              <li key={update.id} className="flex min-w-0 items-start gap-3">
                <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm break-words text-foreground">
                    {formatUpdateHeadline(update, timeZone)}
                  </p>
                  <p className="text-xs break-words text-muted-foreground">
                    {formatUpdateDetail(update, timeZone)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
