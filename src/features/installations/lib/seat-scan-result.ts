import type { JobActionError } from "@/features/jobs/lib/job-errors";
import type { SeatStatus } from "@/features/seats/types";
import type { SeatLastChecks } from "@/features/installations/lib/get-seat-last-checks";

/** What the screen shows after a scan or a typed code (UI-F07-S02). */
export interface SeatScanView {
  /** The seat is the assigned one and has the category the booking requires (spec R6). */
  match: boolean;
  assigned: {
    serial_number: string;
    category_name: string | null;
    /** The category the booking requires; null when it requires none. */
    required_category_name: string | null;
    airport_code: string;
  };
  /**
   * The seat the code names. A seat that RLS hides from this technician is not read, so a code of a seat
   * that is not on one of their jobs has no serial (a scan) or only the typed serial (typed text), and no
   * category or status.
   */
  scanned: {
    /** False when the code names no seat the technician can read: unknown, forged or hidden (spec E3). */
    found: boolean;
    serial_number: string | null;
    category_name: string | null;
    status: SeatStatus | null;
  };
  /** Only for a seat that matches. */
  checks: SeatLastChecks | null;
}

export type VerifySeatScanResult =
  | { success: true; scan: SeatScanView }
  | { success: false; error: JobActionError };

/** Why a scan did not match: the code names no seat, another seat, or the assigned seat with the wrong category. */
export type ScanProblem = "not_found" | "other_seat" | "wrong_category";

/** The reason for a scan that did not match; only called for one. */
export function getScanProblem({ assigned, scanned }: SeatScanView): ScanProblem {
  if (!scanned.found) return "not_found";

  return scanned.serial_number === assigned.serial_number ? "wrong_category" : "other_seat";
}
