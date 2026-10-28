import type { JobActionError } from "@/features/jobs/lib/job-errors";
import type { SeatStatus } from "@/features/seats/types";
import type { SeatLastChecks } from "@/features/installations/lib/get-seat-last-checks";

/** What the screen shows after a scan or a typed code (UI-F07-S02). */
export interface SeatScanView {
  match: boolean;
  assigned: {
    serial_number: string;
    category_name: string | null;
    airport_code: string;
  };
  /**
   * The seat the code names. A seat that RLS hides from this technician is not read, so a code of a seat
   * that is not on one of their jobs has no serial (a scan) or only the typed serial (typed text), and no
   * category or status.
   */
  scanned: {
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
