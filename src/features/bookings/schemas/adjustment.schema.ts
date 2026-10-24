import { z } from "zod";

/** The types of adjustment (spec VI-F04 F7). They match the enum `booking_adjustment_type`. */
export const ADJUSTMENT_TYPES = [
  "partial_refund",
  "full_refund",
  "manual_adjustment",
  "chargeback",
] as const;

export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, string> = {
  partial_refund: "Partial refund",
  full_refund: "Full refund",
  manual_adjustment: "Manual adjustment",
  chargeback: "Chargeback",
};

export const MAX_REASON_LENGTH = 1000;

const hasAtMostTwoDecimals = (value: number) => Math.round(value * 100) / 100 === value;

/**
 * VI-F04-S10 (spec V7 to V9, E6, E7): the type is one of the list, the amount is above zero with at
 * most 2 decimals and not above the gross revenue the booking has now, the reason is required. The
 * gross revenue is an argument: the screen gets it from the server, and the Server Action reads it
 * again, so the amount is never checked against a number the browser sent. The same schema runs on
 * the client and on the server.
 */
export function createAdjustmentSchema(maxAmount: number) {
  return z.object({
    type: z.enum(ADJUSTMENT_TYPES, { error: "Choose the type of adjustment." }),
    amount: z
      .number({ error: "Enter the amount." })
      .positive("The amount must be above zero.")
      .refine(hasAtMostTwoDecimals, "The amount can have at most 2 decimals.")
      .refine(
        (value) => value <= maxAmount,
        `The amount cannot be above the gross revenue of the booking (${maxAmount.toFixed(2)}).`,
      ),
    reason: z
      .string({ error: "Enter the reason." })
      .trim()
      .min(1, "Enter the reason.")
      .max(MAX_REASON_LENGTH, `The reason can have at most ${MAX_REASON_LENGTH} characters.`),
  });
}

export type AdjustmentInput = z.infer<ReturnType<typeof createAdjustmentSchema>>;
