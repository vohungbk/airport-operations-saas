"use server";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { BOOKINGS_IMPORT_PERMISSIONS } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  checkImportFileMeta,
  checkImportHeader,
  decodeCsvText,
  type ImportFileErrorCode,
} from "@/features/bookings/lib/booking-import-file";
import { bookingImportInputSchema } from "@/features/bookings/schemas/booking-import.schema";

export type CheckImportFileResult = { success: true } | { success: false; code: ImportFileErrorCode };

const refuse = (code: ImportFileErrorCode): CheckImportFileResult => ({ success: false, code });

/**
 * CO-F07-S02: checks the file and the partner of an import before any row is looked at. The size and
 * the type come first (E1, V1), then the encoding (E3) and the header (E2). Nothing is saved; the
 * rows are checked and imported by the next stories. The caller must hold the import permission, and
 * the partner must be one the caller can read (RLS).
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
    .select("id")
    .eq("id", input.data.partner_id)
    .maybeSingle();
  if (error || !partner) return refuse("PARTNER_REQUIRED");

  const text = decodeCsvText(await file.arrayBuffer());
  if (text === null) return refuse("UNSUPPORTED_ENCODING");

  const headerError = checkImportHeader(text);
  return headerError ? refuse(headerError) : { success: true };
}
