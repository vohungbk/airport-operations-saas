import { z } from "zod";

import { IMPORT_FILE_ERRORS } from "@/features/bookings/lib/booking-import-file";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs (see booking.schema.ts).
/** CO-F07-S02 (V2): the partner the rows of an import belong to is required. The browser and the server use it. */
export const bookingImportInputSchema = z.object({
  partner_id: z.guid(IMPORT_FILE_ERRORS.PARTNER_REQUIRED.title),
});
