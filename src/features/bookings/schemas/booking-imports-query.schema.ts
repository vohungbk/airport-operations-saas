import { z } from "zod";

import {
  IMPORT_HISTORY_DEFAULT_PERIOD,
  IMPORT_HISTORY_PERIOD_VALUES,
} from "@/features/bookings/lib/booking-import-history";

/** `searchParams` is user-editable: a garbled value falls back to the default instead of failing the page. */
export const bookingImportsQuerySchema = z.object({
  partner_id: z.guid().optional().catch(undefined),
  actor_id: z.guid().optional().catch(undefined),
  period: z.enum(IMPORT_HISTORY_PERIOD_VALUES).catch(IMPORT_HISTORY_DEFAULT_PERIOD),
  page: z.coerce.number().int().min(1).catch(1),
});

export type BookingImportsQuery = z.infer<typeof bookingImportsQuerySchema>;
