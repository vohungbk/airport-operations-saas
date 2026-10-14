import { createClient } from "@/lib/supabase/server";
import { TECHNICIAN_COLUMNS } from "@/features/technicians/lib/technician-columns";
import { buildTechniciansQueryFilters } from "@/features/technicians/lib/build-technicians-query-filters";
import type { TechniciansQuery } from "@/features/technicians/schemas/technicians-query.schema";
import type { Technician } from "@/features/technicians/types";

export interface GetTechniciansResult {
  technicians: Technician[];
  total: number;
}

/**
 * Server-only. A technician is a `users` row with `role = 'technician'`.
 * RLS (`users_select_admin_ops_manager`) is the access boundary; the
 * role filter here only selects which users are "technicians".
 */
export async function getTechnicians(
  query: TechniciansQuery,
): Promise<GetTechniciansResult> {
  const filters = buildTechniciansQueryFilters(query);
  const supabase = await createClient();

  let request = supabase
    .from("users")
    .select(TECHNICIAN_COLUMNS, { count: "exact" })
    .eq("role", "technician")
    .order(filters.sort, { ascending: filters.order === "asc" })
    // Unique tie-breaker so ties never repeat or skip rows across pages.
    .order("id", { ascending: true })
    .range(filters.range.from, filters.range.to);

  if (filters.search) {
    request = request.or(filters.search);
  }

  const { data, error, count } = await request;

  if (error) {
    throw error;
  }

  return { technicians: data ?? [], total: count ?? 0 };
}
