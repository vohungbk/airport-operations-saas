import { createClient } from "@/lib/supabase/server";
import { parseCsv } from "@/features/bookings/lib/booking-import-csv";
import {
  BOOKING_IMPORT_MAX_ROWS,
  checkImportFileMeta,
  checkImportHeader,
  decodeCsvText,
  type ImportFileErrorCode,
} from "@/features/bookings/lib/booking-import-file";
import { BOOKING_IMPORT_TEMPLATE_COLUMNS } from "@/features/bookings/lib/booking-import-template";
import {
  getBookingImportLookups,
  getExistingExternalNumbers,
} from "@/features/bookings/lib/get-booking-import-lookups";
import { buildImportPlan, type ImportPlan } from "@/features/bookings/lib/validate-import-rows";
import { bookingImportInputSchema } from "@/features/bookings/schemas/booking-import.schema";

export type PreparedBookingImport =
  | {
      success: true;
      partnerId: string;
      airportId: string;
      file: File;
      totalRows: number;
      plan: ImportPlan;
    }
  | { success: false; code: ImportFileErrorCode };

const refuse = (code: ImportFileErrorCode): PreparedBookingImport => ({ success: false, code });

/**
 * Server-only. CO-F07-S02 to S05: everything that is known about an import before anything is saved. It reads
 * the partner and the file out of the form, checks them (the size and the type first, so a file over the limit
 * is refused before any byte is read), then the encoding, the header and every row, with the duplicates (R9).
 * The check of a file and the confirmation of an import both start here, so the confirmation never trusts a
 * report the browser holds: it is built again from the file. The caller has checked the import permission.
 */
export async function prepareBookingImport(formData: FormData): Promise<PreparedBookingImport> {
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

  const numberIndex = BOOKING_IMPORT_TEMPLATE_COLUMNS.indexOf("external_booking_number");
  const existingExternalNumbers = await getExistingExternalNumbers(
    supabase,
    partner.id,
    dataRows.map((cells) => (cells[numberIndex] ?? "").trim()),
  );

  return {
    success: true,
    partnerId: partner.id,
    airportId: lookups.airport.id,
    file,
    totalRows: dataRows.length,
    plan: buildImportPlan(
      dataRows,
      { partnerId: partner.id, airportId: lookups.airport.id, categoryIdsByName: lookups.categoryIdsByName },
      { partnerName: partner.name, timezone: lookups.airport.timezone, existingExternalNumbers },
    ),
  };
}
