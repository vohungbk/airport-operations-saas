import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BOOKINGS_IMPORT_PERMISSIONS, hasAnyPermission } from "@/lib/auth/permissions";
import {
  BOOKING_IMPORT_TEMPLATE_FILE_NAME,
  buildBookingImportTemplateCsv,
} from "@/features/bookings/lib/booking-import-template";

/**
 * CO-F07-S01 (R3): the CSV template of the booking import as a download. The caller must be signed in
 * and hold the import permission; a partner user and a technician are refused. The answer to a failure
 * is the standardized error shape.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sign in to download the template.");
  }
  if (!hasAnyPermission(user.role, BOOKINGS_IMPORT_PERMISSIONS)) {
    return apiError("FORBIDDEN", "You cannot import bookings.");
  }

  return new NextResponse(buildBookingImportTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${BOOKING_IMPORT_TEMPLATE_FILE_NAME}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
