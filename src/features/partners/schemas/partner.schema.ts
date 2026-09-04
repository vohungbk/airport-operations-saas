import { z } from "zod";

import { PARTNER_STATUSES } from "@/features/partners/types";

/**
 * `code` uniqueness is enforced by the DB's `partners_code_key` unique
 * constraint, not pre-checked here — a `SELECT`-then-`INSERT` pre-check
 * would leave a TOCTOU race between two concurrent creates with the same
 * code. `create-partner.action.ts` maps the resulting Postgres `23505`
 * error via `partner-errors.ts` instead.
 */
export const createPartnerSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  code: z.string().trim().min(1, "Code is required."),
  contact_email: z.email("Enter a valid contact email address."),
  status: z.enum(PARTNER_STATUSES).default("pending"),
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
  name: z.string().trim().min(1, "Name is required."),
  contact_email: z.email("Enter a valid contact email address."),
  status: z.enum(PARTNER_STATUSES),
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
