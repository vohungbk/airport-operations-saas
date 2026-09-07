import { z } from "zod";

import { isValidIanaTimezone } from "@/features/airports/lib/is-valid-timezone";

/**
 * `code` format is uppercase alphanumeric, 2-10 chars (plan.md's
 * "Quyết định đã chốt" #2) — there is no DB CHECK constraint backing this,
 * only `unique not null`, so this regex is the sole source of truth for
 * format validation (see plan.md's risk note on this gap).
 */
const AIRPORT_CODE_REGEX = /^[A-Z0-9]{2,10}$/;

/**
 * `code` uniqueness is enforced by the DB's `airports_code_key` unique
 * constraint, not pre-checked here — a `SELECT`-then-`INSERT` pre-check
 * would leave a TOCTOU race between two concurrent creates with the same
 * code. `create-airport.action.ts` maps the resulting Postgres `23505`
 * error via `airport-errors.ts` instead, mirroring `partner.schema.ts`.
 */
export const createAirportSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      AIRPORT_CODE_REGEX,
      "Code must be 2-10 uppercase letters/numbers.",
    ),
  name: z.string().trim().min(1, "Name is required."),
  city: z.string().trim().min(1, "City is required."),
  country: z.string().trim().min(1, "Country is required."),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required.")
    .refine(isValidIanaTimezone, "Enter a valid IANA timezone."),
});

export type CreateAirportInput = z.infer<typeof createAirportSchema>;

/**
 * No `code` field — `code` is immutable after creation (see plan.md's
 * "Quyết định đã chốt" #2/#3). The edit form renders `code` read-only for
 * reference only; it is never registered into this schema/submission, so
 * there is no path — not even a disabled-input one — for a client to
 * change it. Mirrors `updatePartnerSchema`.
 */
export const updateAirportSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  city: z.string().trim().min(1, "City is required."),
  country: z.string().trim().min(1, "Country is required."),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required.")
    .refine(isValidIanaTimezone, "Enter a valid IANA timezone."),
});

export type UpdateAirportInput = z.infer<typeof updateAirportSchema>;
