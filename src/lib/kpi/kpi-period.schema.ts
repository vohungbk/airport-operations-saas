import { z } from "zod";

/**
 * The period of the two rate figures: `from` is inside it, `to` is not (the functions read
 * `>= from and < to`). Both are ISO date-times with an offset, as `Date#toISOString` writes them.
 */
export const kpiPeriodSchema = z
  .object({
    from: z.iso.datetime({ offset: true, message: "Start of the period must be a date and time" }),
    to: z.iso.datetime({ offset: true, message: "End of the period must be a date and time" }),
  })
  .refine((period) => Date.parse(period.from) < Date.parse(period.to), {
    path: ["to"],
    message: "End of the period must be after its start",
  });

export type KpiPeriod = z.infer<typeof kpiPeriodSchema>;
