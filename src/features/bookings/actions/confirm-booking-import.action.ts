"use server";

import { createClient } from "@/lib/supabase/server";
import type { ImportFileErrorCode } from "@/features/bookings/lib/booking-import-file";
import { authorizeBookingImport } from "@/features/bookings/lib/authorize-import";
import { prepareBookingImport } from "@/features/bookings/lib/prepare-booking-import";

export interface ConfirmedImport {
  total: number;
  created: number;
  /** The rows that were not imported: errors, duplicates, and rows the database refused. */
  excluded: number;
  partner_name: string;
  timezone: string;
  completed_at: string;
  imported_by: string;
  file_name: string;
  file_size: number;
}

export type ConfirmImportResult =
  | { success: true; result: ConfirmedImport }
  | { success: false; code: ImportFileErrorCode };

/**
 * CO-F07-S05: creates the bookings of a file. The file is read and checked again here, so what is created
 * is what the server found valid and not what the browser showed. Only the valid rows are created (the mode
 * of the design: valid rows only); a row with an error or a duplicate is left out and the report says so.
 * The rows go to `import_bookings()` in one transaction: each through `create_booking()`, so the rules are
 * the ones of a booking typed by hand, each linked to the import and recorded with the source CSV. If the
 * database fails, nothing is created. A caller who does not hold the import permission (any more) gets FORBIDDEN.
 */
export async function confirmBookingImportAction(formData: FormData): Promise<ConfirmImportResult> {
  const user = await authorizeBookingImport();
  if (!user) return { success: false, code: "FORBIDDEN" };

  const prepared = await prepareBookingImport(formData);
  if (!prepared.success) return { success: false, code: prepared.code };
  if (prepared.plan.rows.length === 0) return { success: false, code: "NOTHING_TO_IMPORT" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_bookings", {
    p_partner_id: prepared.partnerId,
    p_airport_id: prepared.airportId,
    p_file_name: prepared.file.name,
    p_file_size_bytes: prepared.file.size,
    p_total_rows: prepared.totalRows,
    p_rows: prepared.plan.rows,
  });
  // 42501: the database checked the role again and refused it (S13, E10).
  if (error?.code === "42501") return { success: false, code: "FORBIDDEN" };
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, code: "IMPORT_FAILED" };
  }

  const answer = data as { created: unknown[] };
  const created = answer.created.length;

  return {
    success: true,
    result: {
      total: prepared.totalRows,
      created,
      excluded: prepared.totalRows - created,
      partner_name: prepared.plan.report.partner_name,
      timezone: prepared.plan.report.timezone,
      completed_at: new Date().toISOString(),
      imported_by: user.full_name,
      file_name: prepared.file.name,
      file_size: prepared.file.size,
    },
  };
}
