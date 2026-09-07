import { createClient } from "@/lib/supabase/server";
import { buildAirportsQueryFilters } from "@/features/airports/lib/build-airports-query-filters";
import type { AirportsQuery } from "@/features/airports/schemas/airports-query.schema";
import type { Airport } from "@/features/airports/types";

export interface GetAirportsResult {
  airports: Airport[];
  total: number;
}

/**
 * Explicit column list (snake_case, matching the DB) instead of
 * `select("*")` — the row is small and this keeps the shape stable and
 * self-documenting per `backend.md`.
 */
const AIRPORT_COLUMNS =
  "id, code, name, city, country, timezone, created_at, updated_at";

/**
 * Server-only. RLS (`F05`) is the actual tenant/role boundary here — this
 * never adds its own `WHERE` clause for access control, only for the
 * page's search/sort/pagination UI.
 */
export async function getAirports(
  query: AirportsQuery,
): Promise<GetAirportsResult> {
  const filters = buildAirportsQueryFilters(query);
  const supabase = await createClient();

  let request = supabase
    .from("airports")
    .select(AIRPORT_COLUMNS, { count: "exact" })
    .order(filters.sort, { ascending: filters.order === "asc" })
    .range(filters.range.from, filters.range.to);

  if (filters.search) {
    request = request.or(filters.search);
  }

  const { data, error, count } = await request;

  if (error) {
    throw error;
  }

  return { airports: data ?? [], total: count ?? 0 };
}
