"use server";

import { authorizeBookingImport } from "@/features/bookings/lib/authorize-import";
import type { ImportFileErrorCode } from "@/features/bookings/lib/booking-import-file";
import { prepareBookingImport } from "@/features/bookings/lib/prepare-booking-import";
import type { ImportReport } from "@/features/bookings/lib/validate-import-rows";

export type CheckImportFileResult =
  | { success: true; report: ImportReport }
  | { success: false; code: ImportFileErrorCode };

/**
 * CO-F07-S02, S03, S04: checks the file and the partner of an import, then every row of the file (with the
 * duplicates), and answers with the report. Nothing is saved: the bookings are created only after the user
 * confirms (R1, `confirmBookingImportAction`). A caller who does not hold the import permission (any more) gets
 * FORBIDDEN (S13, E10), and the partner must be one the caller can read (RLS).
 */
export async function checkBookingImportFileAction(formData: FormData): Promise<CheckImportFileResult> {
  if (!(await authorizeBookingImport())) return { success: false, code: "FORBIDDEN" };

  const prepared = await prepareBookingImport(formData);

  return prepared.success ? { success: true, report: prepared.plan.report } : { success: false, code: prepared.code };
}
