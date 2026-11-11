import { formatJobDeadline } from "@/features/jobs/lib/job-deadline";
import type { CleaningRecord } from "@/features/cleaning/lib/get-cleaning-context";
import {
  getElapsedMinutes,
  type CleaningPanelState,
} from "@/features/cleaning/lib/cleaning-panel-state";
import type { SeatBookingConflict } from "@/features/cleaning/lib/get-seat-booking-conflict";
import type { SeatStatus } from "@/features/seats/types";

/** Everything the panel shows, already formatted, so only plain strings cross to the client. */
export interface CleaningPanelView {
  state: CleaningPanelState;
  jobId: string;
  seatSerial: string;
  seatStatus: SeatStatus;
  /** `03 Nov 2026 17:20 GST · Success`; null when the seat was never cleaned. */
  lastCleaning: string | null;
  startedLine: string | null;
  completedLine: string | null;
  failedLine: string | null;
  recordedLine: string | null;
  conflict: {
    bookingId: string;
    bookingNumber: string;
    period: string;
  } | null;
}

interface BuildInput {
  state: CleaningPanelState;
  jobId: string;
  seat: {
    serial_number: string;
    status: SeatStatus;
    quarantine_reason: string | null;
  };
  cleaning: CleaningRecord | null;
  conflict: SeatBookingConflict | null;
  lastCleaning: { at: string; outcome: string } | null;
  timeZone: string;
  now: Date;
}

/** Pure: turns the loaded data into the lines of the panel of the design. */
export function buildCleaningPanelView({
  state,
  jobId,
  seat,
  cleaning,
  conflict,
  lastCleaning,
  timeZone,
  now,
}: BuildInput): CleaningPanelView {
  const staff = cleaning?.recorded_by ?? "staff";
  const at = (iso: string) => formatJobDeadline(iso, timeZone);
  const completedAt = cleaning?.completed_at ?? null;

  return {
    state,
    jobId,
    seatSerial: seat.serial_number,
    seatStatus: seat.status,
    lastCleaning: lastCleaning
      ? `${at(lastCleaning.at)} · ${lastCleaning.outcome}`
      : null,
    startedLine:
      state === "in_progress" && cleaning
        ? `Started by ${staff} at ${at(cleaning.started_at)}. Elapsed ${getElapsedMinutes(cleaning.started_at, now)} min.`
        : null,
    completedLine:
      state === "completed_passed" && completedAt
        ? `Cleaning completed by ${staff} at ${at(completedAt)}.`
        : null,
    failedLine:
      state === "failed"
        ? seat.quarantine_reason
          ? `Result: Failed. Quarantine reason: ${seat.quarantine_reason}.`
          : "Result: Failed."
        : null,
    recordedLine:
      state === "failed" && completedAt
        ? `Recorded by ${staff} · ${at(completedAt)}`
        : null,
    conflict: conflict && {
      bookingId: conflict.id,
      bookingNumber: conflict.booking_number,
      period: `${at(conflict.pickup_at)} - ${at(conflict.return_at)}`,
    },
  };
}
