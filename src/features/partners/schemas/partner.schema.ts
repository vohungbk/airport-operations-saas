import { z } from "zod";

import { PARTNER_STATUSES } from "@/features/partners/types";

/**
 * `code` uniqueness is enforced by the DB's `partners_code_key` unique
 * constraint, not pre-checked here — a `SELECT`-then-`INSERT` pre-check
 * would leave a TOCTOU race between two concurrent creates with the same
 * code. `create-partner.action.ts` maps the resulting Postgres `23505`
 * error via `partner-errors.ts` instead.
 */
/** The contact fields are optional; an empty value is stored as null by the actions. */
const contactName = z.string().trim().max(120, "Contact name is too long.");
const contactPhone = z.string().trim().max(40, "Contact phone is too long.");
const contactEmail = z.union([
  z.literal(""),
  z.email("Enter a valid email address."),
]);
export const PARTNER_NOTES_MAX_LENGTH = 500;
const notes = z
  .string()
  .trim()
  .max(PARTNER_NOTES_MAX_LENGTH, "Notes are too long.");

/**
 * `code` uniqueness is enforced by the DB's `partners_code_key` unique
 * constraint, not pre-checked here — a `SELECT`-then-`INSERT` pre-check
 * would leave a TOCTOU race between two concurrent creates with the same
 * code. `create-partner.action.ts` maps the resulting Postgres `23505`
 * error via `partner-errors.ts` instead.
 */
export const createPartnerSchema = z.object({
  name: z.string().trim().min(1, "Partner name is required."),
  code: z.string().trim().min(1, "Partner code is required."),
  contact_email: z.string().trim().pipe(contactEmail).default(""),
  contact_name: contactName.default(""),
  contact_phone: contactPhone.default(""),
  notes: notes.default(""),
  status: z.enum(PARTNER_STATUSES).default("active"),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;

/**
 * No `code` field — `code` is immutable after creation (see plan.md's
 * "Quyết định đã chốt" #2). The edit form renders `code` read-only for
 * reference only; it is never registered into this schema/submission, so
 * there is no path — not even a disabled-input one — for a client to
 * change it.
 */
export const updatePartnerSchema = z.object({
  name: z.string().trim().min(1, "Partner name is required."),
  contact_email: z.string().trim().pipe(contactEmail).default(""),
  contact_name: contactName.default(""),
  contact_phone: contactPhone.default(""),
  notes: notes.default(""),
  status: z.enum(PARTNER_STATUSES),
  /**
   * The `updated_at` the form was loaded with. The update only applies while the row still has it,
   * so a save over a change made by someone else is refused (`CONFLICT`), not silently overwritten.
   */
  updated_at: z.string().min(1, "Partner version is required."),
});

export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

/**
 * Input for `deactivate-partner.action.ts` — a dedicated action, not the
 * generic `updatePartnerSchema`, since it only ever targets
 * `status = 'inactive'` for one id (see plan.md's "Quyết định đã chốt" #4).
 * Only checks non-empty, not strict UUID format — a garbled id simply
 * matches zero rows and surfaces as `NOT_FOUND`, so the DB stays the
 * source of truth for id validity rather than duplicating that check here
 * (also avoids `z.uuid()`'s strict RFC version-nibble check rejecting
 * this codebase's hand-rolled, non-RFC-compliant seed/test ids).
 */
export const deactivatePartnerSchema = z.object({
  partner_id: z.string().min(1, "Partner id is required."),
});

export type DeactivatePartnerInput = z.infer<typeof deactivatePartnerSchema>;
