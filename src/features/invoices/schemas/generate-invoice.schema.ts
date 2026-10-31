import { z } from "zod";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const PERIOD_REQUIRED = "Select a period with an approved settlement.";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
/**
 * VI-F09-S06 (spec V2): the partner and the period are required, and the period is a real month. Whether the
 * settlement of that month is approved is checked by the database function. The same schema runs on the client
 * and on the server.
 */
export const generateInvoiceSchema = z.object({
  partner_id: z.guid("Choose a partner."),
  month: z.string({ error: PERIOD_REQUIRED }).min(1, PERIOD_REQUIRED).regex(MONTH_PATTERN, PERIOD_REQUIRED),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
