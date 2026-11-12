import type { InspectionResult } from "@/features/inspections/schemas/record-inspection.schema";
import { RETURN_QUEUE_STEP_LABEL, type ReturnQueueStep } from "@/features/return-queue/lib/return-chain";

export const CHAIN_HISTORY_LIMIT = 100;

/** A stored chain step, as the history query returns it. */
export interface ChainHistoryRow {
  id: string;
  step: string;
  result: InspectionResult;
  notes: string | null;
  photo_paths: string[];
  completed_at: string;
  completed_by_user: { full_name: string } | null;
  booking: { booking_number: string } | null;
}

/** A step ready to show: no database shape, no formatting of the time. */
interface ChainHistoryEntry {
  id: string;
  step_label: string;
  result: InspectionResult;
  actor: string | null;
  occurred_at: string;
  /** The note of the step, if any. */
  note: string | null;
  /** `2 photos`, `1 photo`. */
  photos_label: string;
  /** The booking the step belongs to; only set when the screen shows several bookings. */
  booking_number: string | null;
}

const photosLabel = (count: number): string => `${count} ${count === 1 ? "photo" : "photos"}`;

/** Rows to entries, keeping the order given (newest first). Pure. */
export function toChainHistoryEntries(rows: readonly ChainHistoryRow[], showBooking: boolean): ChainHistoryEntry[] {
  return rows.map((row) => ({
    id: row.id,
    step_label: RETURN_QUEUE_STEP_LABEL[row.step as ReturnQueueStep] ?? row.step,
    result: row.result,
    actor: row.completed_by_user?.full_name ?? null,
    occurred_at: row.completed_at,
    note: row.notes,
    photos_label: photosLabel(row.photo_paths.length),
    booking_number: showBooking ? (row.booking?.booking_number ?? null) : null,
  }));
}
