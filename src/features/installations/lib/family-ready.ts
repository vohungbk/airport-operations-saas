import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { getNextStep } from "@/features/bookings/lib/booking-move";
import type { BookingStatus } from "@/features/bookings/types";
import { formatDate, formatTime, zoneLabel } from "@/features/jobs/lib/job-time";
import { stepOf } from "@/lib/workflow/board";

/**
 * Pure rules for the installation / Family Ready screen (FO-F07-S07, spec R4). The booking is at one of
 * the 13 steps; the technician moves it through the field steps. Family Ready is markable from En Route
 * (the installation moves it to Installed, and this catches up when that did not happen) or from Installed.
 */

export type FamilyReadyState = "markable" | "already" | "not_ready";

function indexOf(status: BookingStatus): number {
  // `stepOf` numbers the steps from 1 and gives `null` off the path (cancelled, no show): -1 as before.
  return (stepOf(status)?.number ?? 0) - 1;
}

export function getFamilyReadyState(status: BookingStatus): FamilyReadyState {
  const index = indexOf(status);

  if (index >= indexOf("family_ready")) {
    return "already";
  }

  return index >= indexOf("en_route") ? "markable" : "not_ready";
}

/**
 * Server-only. Moves a booking one step at a time to `target` with `move_booking_to_next_step()`, which
 * checks the role, the assignment and the seat, and moves the seat status with the step. Stops at the
 * first error and returns it; `null` when the booking is at `target`.
 */
export async function moveBookingToStep(
  supabase: Pick<SupabaseClient, "rpc">,
  bookingId: string,
  from: BookingStatus,
  target: BookingStatus,
): Promise<PostgrestError | null> {
  let current = from;

  while (indexOf(current) < indexOf(target)) {
    const next = getNextStep(current);

    if (!next) {
      return null;
    }

    const { error } = await supabase.rpc("move_booking_to_next_step", {
      p_booking_id: bookingId,
      p_expected_status: current,
    });

    if (error) {
      return error;
    }

    current = next;
  }

  return null;
}

/** The three confirmations of the screen (ME3). They gate the button and are not stored. */
export const FAMILY_READY_CHECKS = [
  { key: "installation_checked", label: "Seat installation is complete and checked" },
  { key: "vehicle_and_bay", label: "Vehicle and assigned bay are correct" },
  { key: "keys_and_handover", label: "Keys and handover information are ready" },
] as const;

export type FamilyReadyCheckKey = (typeof FAMILY_READY_CHECKS)[number]["key"];

export function isEveryCheckConfirmed(checked: readonly string[]): boolean {
  return FAMILY_READY_CHECKS.every((check) => checked.includes(check.key));
}

/** `Omar Haddad · 24 Oct 2026 · 14:18 GST`: the line under the banner "Installation completed". */
export function installationBannerLine(
  recordedBy: string | null,
  completedAt: string,
  timeZone: string,
): string {
  return [
    recordedBy,
    formatDate(completedAt, timeZone),
    `${formatTime(completedAt, timeZone)} ${zoneLabel(timeZone)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
