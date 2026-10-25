import { createClient } from "@/lib/supabase/server";
import type { SettlementStatus } from "@/features/settlements/lib/settlement";

export interface SettlementRow {
  id: string;
  period_start: string;
  gross_revenue: number;
  partner_share: number;
  platform_share: number;
  refunds: number;
  adjustments: number;
  chargebacks: number;
  launch_credit: number;
  fees: number;
  final_amount: number;
  status: SettlementStatus;
  partner: { name: string; code: string } | null;
}

/** Explicit columns (VI-F04-S12), with the partner in the same round trip. */
export const SETTLEMENTS_SELECT =
  "id, period_start, gross_revenue, partner_share, platform_share, refunds, adjustments, chargebacks, launch_credit, fees, final_amount, status, partner:partners(name, code)";

/** More than this many settlements on one page is not expected yet. */
export const SETTLEMENTS_LIMIT = 200;

/**
 * Server-only, with the user's own client: RLS gives an admin and an operations manager every
 * settlement and a partner user only those of its own partner. Newest month first.
 */
export async function getSettlements(): Promise<SettlementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settlements")
    .select(SETTLEMENTS_SELECT)
    .order("period_start", { ascending: false })
    .limit(SETTLEMENTS_LIMIT);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as SettlementRow[];
}
