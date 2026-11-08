import { z } from "zod";

import { BASELINE_FIELDS, type BaselineFieldKind, type BaselineFieldName } from "@/features/roi/lib/baseline-inputs";

const MAX_AMOUNT = 9_999_999_999.99;
const MAX_COUNT = 2_147_483_647;

const required = (title: string) => z.number({ error: `${title} is required.` });

const twoDecimals = (title: string) =>
  [(value: number) => Math.round(value * 100) / 100 === value, `${title} can have at most 2 decimals.`] as const;

/** An amount, minutes or days (spec V2, V3, V4): zero or more, exact to 2 decimals, and it fits the column. */
const amount = (title: string) =>
  required(title)
    .min(0, `${title} must be zero or more.`)
    .max(MAX_AMOUNT, `${title} is too large.`)
    .refine(...twoDecimals(title));

/** A count of seats or enquiries (spec V3, V4): a whole number, zero or more. */
const count = (title: string) =>
  required(title)
    .int(`${title} must be a whole number.`)
    .min(0, `${title} must be zero or more.`)
    .max(MAX_COUNT, `${title} is too large.`);

/** A conversion (spec V4): from 0 to 100 percent, exact to 2 decimals. */
const percent = (title: string) =>
  required(title)
    .min(0, `${title} must be from 0 to 100.`)
    .max(100, `${title} must be from 0 to 100.`)
    .refine(...twoDecimals(title));

const RULE_OF = { amount, count, percent } satisfies Record<BaselineFieldKind, (title: string) => z.ZodNumber>;

/**
 * VI-F05-S05 (spec V2 to V4): the rule of every field of the Baseline inputs screen, picked by the kind of
 * the field, so the screen and the rule cannot drift apart. The same schema runs in the form and in the
 * Server Action, and the database function checks the same rules again.
 */
export const baselineInputsSchema = z.object(
  Object.fromEntries(BASELINE_FIELDS.map((field) => [field.name, RULE_OF[field.kind](field.title)])) as Record<
    BaselineFieldName,
    z.ZodNumber
  >,
);
