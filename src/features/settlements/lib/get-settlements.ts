import { createClient } from "@/lib/supabase/server";
import type { SettlementStatus } from "@/features/settlements/lib/settlement";
import {
  SETTLEMENTS_PAGE_SIZE,
  type SettlementsQuery,
} from "@/features/settlements/schemas/settlements-query.schema";

export interface SettlementRow {
  id: string;
  settlement_number: string;
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
  status_changed_at: string;
  partner: { name: string; code: string } | null;
}

export interface GetSettlementsResult {
  settlements: SettlementRow[];
  total: number;
  /** The page returned; differs from the requested page when that one was past the last row. */
  page: number;
}

/** Explicit columns (VI-F04-S12), with the partner in the same round trip. */
export const SETTLEMENTS_SELECT =
  "id, settlement_number, period_start, gross_revenue, partner_share, platform_share, refunds, adjustments, chargebacks, launch_credit, fees, final_amount, status, status_changed_at, partner:partners(name, code)";

/** PostgREST error code for a `Range` offset past the last row (HTTP 416). */
const RANGE_NOT_SATISFIABLE = "PGRST103";

/**
 * Server-only, with the user's own client: RLS gives an admin and an operations manager every
 * settlement and a partner user only those of its own partner. Newest month first; the filters of the
 * query narrow what RLS already allows. A page past the last row is served as the last page.
 */
export async function getSettlements(query: SettlementsQuery): Promise<GetSettlementsResult> {
  const supabase = await createClient();

  const fetchPage = (page: number) => {
    const from = (page - 1) * SETTLEMENTS_PAGE_SIZE;
    let request = supabase.from("settlements").select(SETTLEMENTS_SELECT, { count: "exact" });

    if (query.partner_id) request = request.eq("partner_id", query.partner_id);
    if (query.month) request = request.eq("period_start", `${query.month}-01`);
    if (query.status) request = request.eq("status", query.status);

    return (
      request
        .order("period_start", { ascending: false })
        // Unique tie-breaker so ties never repeat or skip rows across pages.
        .order("settlement_number", { ascending: false })
        .range(from, from + SETTLEMENTS_PAGE_SIZE - 1)
    );
  };

  const first = await fetchPage(query.page);

  if (!first.error) {
    return {
      settlements: (first.data ?? []) as unknown as SettlementRow[],
      total: first.count ?? 0,
      page: query.page,
    };
  }

  if (first.error.code !== RANGE_NOT_SATISFIABLE || query.page === 1) {
    throw first.error;
  }

  // The 416 response carries no count: count with a head request, then serve the last page.
  let counter = supabase.from("settlements").select("id", { count: "exact", head: true });

  if (query.partner_id) counter = counter.eq("partner_id", query.partner_id);
  if (query.month) counter = counter.eq("period_start", `${query.month}-01`);
  if (query.status) counter = counter.eq("status", query.status);

  const { count, error: countError } = await counter;

  if (countError) {
    throw countError;
  }

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / SETTLEMENTS_PAGE_SIZE));
  const retry = await fetchPage(lastPage);

  if (retry.error) {
    throw retry.error;
  }

  return { settlements: (retry.data ?? []) as unknown as SettlementRow[], total, page: lastPage };
}
