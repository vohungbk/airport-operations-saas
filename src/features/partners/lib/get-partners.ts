import { createClient } from "@/lib/supabase/server";
import { buildPartnersQueryFilters } from "@/features/partners/lib/build-partners-query-filters";
import type { PartnersQuery } from "@/features/partners/schemas/partners-query.schema";
import type { Partner } from "@/features/partners/types";

export interface GetPartnersResult {
  partners: Partner[];
  total: number;
}

/**
 * Explicit column list (snake_case, matching the DB) instead of
 * `select("*")` — the row is small and this keeps the shape stable and
 * self-documenting per `backend.md`.
 */
const PARTNER_COLUMNS =
  "id, name, code, contact_email, status, created_at, updated_at";

/**
 * Server-only. RLS (`F05`) is the actual tenant/role boundary here — this
 * never adds its own `WHERE` clause for access control, only for the
 * page's search/filter/sort/pagination UI. Never joins `bookings`/`seats`
 * (out of scope for F06 — see the placeholder decision in
 * `partner-detail.tsx`).
 */
export async function getPartners(
  query: PartnersQuery,
): Promise<GetPartnersResult> {
  const filters = buildPartnersQueryFilters(query);
  const supabase = await createClient();

  let request = supabase
    .from("partners")
    .select(PARTNER_COLUMNS, { count: "exact" })
    .order(filters.sort, { ascending: filters.order === "asc" })
    .range(filters.range.from, filters.range.to);

  if (filters.search) {
    request = request.or(filters.search);
  }

  if (filters.status) {
    request = request.eq("status", filters.status);
  }

  const { data, error, count } = await request;

  if (error) {
    throw error;
  }

  return { partners: data ?? [], total: count ?? 0 };
}
