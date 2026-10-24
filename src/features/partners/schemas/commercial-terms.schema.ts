import { z } from "zod";

const hasAtMostTwoDecimals = (value: number) => Math.round(value * 100) / 100 === value;

const percent = (label: string) =>
  z
    .number({ error: `${label} is required.` })
    .min(0, `${label} must be from 0 to 100.`)
    .max(100, `${label} must be from 0 to 100.`)
    .refine(hasAtMostTwoDecimals, `${label} can have at most 2 decimals.`);

/**
 * VI-F04-S01 (spec V1, V2): the partner share is from 0 to 100 (the platform share is the
 * rest, so the two add up to 100) and the launch share is from 0 to 100 and not below the
 * partner share. The effective date is today or later: "today" is the date of the server (UTC),
 * which the database uses too, so it is an argument and the screen gets it from the server.
 * The same schema runs on the client and on the server.
 */
export function createCommercialTermsSchema(today: string) {
  return z
    .object({
      partner_share_percent: percent("The partner share"),
      launch_partner_share_percent: percent("The launch partner share"),
      effective_from: z
        .iso.date("Enter a valid effective date.")
        .refine((value) => value >= today, "The effective date cannot be in the past."),
    })
    .superRefine((terms, context) => {
      if (terms.launch_partner_share_percent < terms.partner_share_percent) {
        context.addIssue({
          code: "custom",
          path: ["launch_partner_share_percent"],
          message: "The launch partner share cannot be below the partner share.",
        });
      }
    });
}

export type CommercialTermsInput = z.infer<ReturnType<typeof createCommercialTermsSchema>>;

export const partnerIdSchema = z.guid();
