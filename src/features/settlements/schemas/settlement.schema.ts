import { z } from "zod";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The current month as `YYYY-MM`, in UTC (the same clock the database uses). */
export function currentMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
/**
 * VI-F04-S12 (spec F10, V10): the month is required, is a real month and is not in the future. The
 * same schema runs on the client and on the server; `now` is an argument so a test can fix the
 * clock. `YYYY-MM` strings compare in date order.
 */
export function createGenerateSettlementSchema(now: Date = new Date()) {
  const thisMonth = currentMonth(now);

  return z.object({
    partner_id: z.guid("Choose a partner."),
    month: z
      .string({ error: "Choose the month." })
      .min(1, "Choose the month.")
      .regex(MONTH_PATTERN, "Choose a valid month.")
      .refine((value) => value <= thisMonth, "The month cannot be in the future."),
  });
}

export type GenerateSettlementInput = z.infer<ReturnType<typeof createGenerateSettlementSchema>>;

export const SETTLEMENT_STATUSES = ["draft", "pending_approval", "approved", "paid"] as const;

/** VI-F04-S13 (spec R8): which settlement and which status. They match the enum `settlement_status`. */
export const moveSettlementSchema = z.object({
  settlement_id: z.guid("Choose a settlement."),
  to_status: z.enum(SETTLEMENT_STATUSES, { error: "Choose a status." }),
});

export type MoveSettlementInput = z.infer<typeof moveSettlementSchema>;
