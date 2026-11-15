"use server";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { BOOKINGS_IMPORT_PERMISSIONS } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { parseCsv } from "@/features/bookings/lib/booking-import-csv";
import {
  BOOKING_IMPORT_MAX_ROWS,
  checkImportFileMeta,
  checkImportHeader,
  decodeCsvText,
  type ImportFileErrorCode,
} from "@/features/bookings/lib/booking-import-file";
import { getBookingImportLookups } from "@/features/bookings/lib/get-booking-import-lookups";
import { buildImportReport, type ImportReport } from "@/features/bookings/lib/validate-import-rows";
import { bookingImportInputSchema } from "@/features/bookings/schemas/booking-import.schema";

export type CheckImportFileResult =
  | { success: true; report: ImportReport }
  | { success: false; code: ImportFileErrorCode };

const refuse = (code: ImportFileErrorCode): CheckImportFileResult => ({ success: false, code });

/**
 * CO-F07-S02, S03: checks the file and the partner of an import, then every row of the file, and answers
 * with the report. The size and the type come first (E1, V1), so a file over the limit is refused before
 * any byte is read; then the encoding (E3) and the header (E2); then each row is checked by the rules of
 * manual entry (R7, R8). Nothing is saved: the bookings are created only after the user confirms (R1).
 * The caller must hold the import permission, and the partner must be one the caller can read (RLS).
 */
export async function checkBookingImportFileAction(formData: FormData): Promise<CheckImportFileResult> {
  await requireAnyPermission(BOOKINGS_IMPORT_PERMISSIONS);

  const input = bookingImportInputSchema.safeParse({ partner_id: formData.get("partner_id") });
  if (!input.success) return refuse("PARTNER_REQUIRED");

  const file = formData.get("file");
  if (!(file instanceof File)) return refuse("FILE_REQUIRED");

  const metaError = checkImportFileMeta(file);
  if (metaError) return refuse(metaError);

  const supabase = await createClient();
  const { data: partner, error } = await supabase
    .from("partners")
    .select("id, name")
    .eq("id", input.data.partner_id)
    .maybeSingle();
  if (error || !partner) return refuse("PARTNER_REQUIRED");

  const text = decodeCsvText(await file.arrayBuffer());
  if (text === null) return refuse("UNSUPPORTED_ENCODING");

  const headerError = checkImportHeader(text);
  if (headerError) return refuse(headerError);

  const dataRows = parseCsv(text).slice(1);
  if (dataRows.length === 0) return refuse("NO_ROWS");
  if (dataRows.length > BOOKING_IMPORT_MAX_ROWS) return refuse("TOO_MANY_ROWS");

  const lookups = await getBookingImportLookups(supabase);
  if (!lookups.airport) return refuse("AIRPORT_UNAVAILABLE");

  const report = buildImportReport(
    dataRows,
    { partnerId: partner.id, airportId: lookups.airport.id, categoryIdsByName: lookups.categoryIdsByName },
    { partnerName: partner.name, timezone: lookups.airport.timezone },
  );

  return { success: true, report };
}
