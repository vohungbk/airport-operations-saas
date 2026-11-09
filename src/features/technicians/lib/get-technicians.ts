import { createClient } from "@/lib/supabase/server";
import { TECHNICIAN_COLUMNS } from "@/features/technicians/lib/technician-columns";
import { buildTechniciansQueryFilters } from "@/features/technicians/lib/build-technicians-query-filters";
import type { TechniciansQuery } from "@/features/technicians/schemas/technicians-query.schema";
import type { TechnicianListRow } from "@/features/technicians/types";

/** Row of `technician_list_figures`; the server client is untyped, so it is typed here. */
interface TechnicianFiguresRow {
  technician_id: string;
  airport_name: string | null;
  airport_code: string | null;
  open_jobs: number;
  jobs_done_this_week: number;
}

export interface GetTechniciansResult {
  technicians: TechnicianListRow[];
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

  const users = data ?? [];

  if (users.length === 0) {
    return { technicians: [], total: count ?? 0 };
  }

  // One call for the whole page keeps this free of N+1 queries.
  const { data: figures, error: figuresError } = await supabase.rpc(
    "technician_list_figures",
    { p_technician_ids: users.map((user) => user.id) },
  );

  if (figuresError) {
    throw figuresError;
  }

  const figuresById = new Map<string, TechnicianFiguresRow>(
    ((figures ?? []) as TechnicianFiguresRow[]).map((row) => [
      row.technician_id,
      row,
    ]),
  );

  const technicians = users.map((user) => {
    const row = figuresById.get(user.id);

    return {
      ...user,
      airport_name: row?.airport_name ?? null,
      airport_code: row?.airport_code ?? null,
      open_jobs: row?.open_jobs ?? 0,
      jobs_done_this_week: row?.jobs_done_this_week ?? 0,
    };
  });

  return { technicians, total: count ?? 0 };
}
