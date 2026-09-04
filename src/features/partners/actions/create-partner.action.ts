"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { createPartnerSchema } from "@/features/partners/schemas/partner.schema";
import {
  VALIDATION_ERROR,
  mapPartnerError,
  type PartnerActionError,
} from "@/features/partners/lib/partner-errors";

export interface CreatePartnerActionResult {
  success: boolean;
  error?: PartnerActionError;
}

/**
 * Re-checks `partners:manage` server-side before touching the database —
 * never trust that the page/layout guard already ran, per
 * `backend.md`/`docs/security.md`'s defense-in-depth precedent from F04.
 * `code` uniqueness is enforced by the DB's unique constraint and mapped
 * from the resulting `23505` via `partner-errors.ts`, not pre-checked
 * here (see `partner.schema.ts`'s comment on the TOCTOU race that would
 * introduce).
 */
export async function createPartnerAction(
  input: unknown,
): Promise<CreatePartnerActionResult> {
  await requirePermission("partners:manage");

  const parsed = createPartnerSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: mapPartnerError(error) };
  }

  redirect(`/partners/${data.id}`);
}
