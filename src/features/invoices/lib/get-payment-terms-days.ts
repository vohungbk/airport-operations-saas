import {
  DEFAULT_PAYMENT_TERMS_DAYS,
  pickCommercialTerms,
  utcToday,
} from "@/features/partners/lib/commercial-terms";
import { getCommercialTerms } from "@/features/partners/lib/get-commercial-terms";

/**
 * Server-only (VI-F09-S07). The payment terms of a partner in days, from the version of its commercial terms in force
 * today (UTC), or 14 days when it has none, as `issue_invoice()` does. A failed read is thrown.
 */
export async function getPaymentTermsDays(partnerId: string): Promise<number> {
  const { versions } = await getCommercialTerms(partnerId);

  return pickCommercialTerms(versions, utcToday()).current?.payment_terms_days ?? DEFAULT_PAYMENT_TERMS_DAYS;
}
