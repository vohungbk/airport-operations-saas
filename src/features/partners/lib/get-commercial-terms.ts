import { createClient } from "@/lib/supabase/server";
import type { CommercialTermsVersion } from "@/features/partners/lib/commercial-terms";
import { partnerIdSchema } from "@/features/partners/schemas/commercial-terms.schema";

/** Explicit columns: the terms, the dates, the launch credit counted so far and the name of who saved them. No partner data. */
export const COMMERCIAL_TERMS_SELECT =
  "id, partner_share_percent, platform_share_percent, launch_partner_share_percent, launch_credit_target, annual_fee, onboarding_fee, vat_rate_percent, payment_terms_days, effective_from, effective_to, launch_credit_accumulated, changed_by_user:users!changed_by(full_name)";

/** More than this many versions of one partner is not expected to be shown (a note says so). */
export const COMMERCIAL_TERMS_LIMIT = 100;

export interface CommercialTermsResult {
  versions: CommercialTermsVersion[];
  /** True when older versions were cut off by the limit. */
  truncated: boolean;
}

/**
 * Server-only. The versions of the terms of one partner, newest first, with the user's own
 * client: RLS gives an admin or an operations manager every partner and a partner user only
 * its own. An empty list is a partner with no terms yet (or one the user cannot see).
 */
export async function getCommercialTerms(partnerId: string): Promise<CommercialTermsResult> {
  if (!partnerIdSchema.safeParse(partnerId).success) {
    return { versions: [], truncated: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_commercial_terms")
    .select(COMMERCIAL_TERMS_SELECT)
    .eq("partner_id", partnerId)
    .order("effective_from", { ascending: false })
    // One more than the limit tells whether older versions were cut off.
    .limit(COMMERCIAL_TERMS_LIMIT + 1);

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as unknown as Array<
    Omit<CommercialTermsVersion, "changed_by_name"> & { changed_by_user: { full_name: string } | null }
  >).map(({ changed_by_user, ...version }) => ({
    ...version,
    changed_by_name: changed_by_user?.full_name ?? null,
  }));

  return {
    versions: rows.slice(0, COMMERCIAL_TERMS_LIMIT),
    truncated: rows.length > COMMERCIAL_TERMS_LIMIT,
  };
}
