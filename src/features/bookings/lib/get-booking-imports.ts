import { createClient } from "@/lib/supabase/server";
import { getBookingImportLookups } from "@/features/bookings/lib/get-booking-import-lookups";
import {
  IMPORT_HISTORY_PAGE_SIZE,
  getImportHistoryPeriodStart,
} from "@/features/bookings/lib/booking-import-history";
import type { BookingImportsQuery } from "@/features/bookings/schemas/booking-imports-query.schema";

export interface BookingImportItem {
  id: string;
  file_name: string;
  partner_name: string | null;
  actor_name: string | null;
  created_at: string;
  created_rows: number;
  rejected_rows: number;
}

export interface BookingImportsResult {
  items: BookingImportItem[];
  total: number;
  /** Page actually returned; differs from the requested page when it was out of range. */
  page: number;
  /** The time zone the times of the list are shown in. */
  timezone: string;
}

export interface BookingImportFilterOptions {
  partners: { value: string; label: string }[];
  actors: { value: string; label: string }[];
}

interface ImportRow extends Omit<BookingImportItem, "partner_name" | "actor_name"> {
  partner: { name: string } | null;
  actor: { full_name: string } | null;
}

/** PostgREST error code for a `Range` offset past the last row. */
const RANGE_NOT_SATISFIABLE = "PGRST103";

const IMPORT_SELECT =
  "id, file_name, created_at, created_rows, rejected_rows, partner:partners(name), actor:users!booking_imports_created_by_fkey(full_name)";

/**
 * Server-only. CO-F07-S07 (R4): the imports, newest first, in one query with their partner and actor.
 * RLS decides who sees any (an admin and an operations manager); the filters only narrow the list.
 */
export async function getBookingImports(query: BookingImportsQuery, now = new Date()): Promise<BookingImportsResult> {
  const supabase = await createClient();
  const periodStart = getImportHistoryPeriodStart(query.period, now);

  const read = async (page: number) => {
    let request = supabase
      .from("booking_imports")
      .select(IMPORT_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * IMPORT_HISTORY_PAGE_SIZE, page * IMPORT_HISTORY_PAGE_SIZE - 1);

    if (query.partner_id) request = request.eq("partner_id", query.partner_id);
    if (query.actor_id) request = request.eq("created_by", query.actor_id);
    if (periodStart) request = request.gte("created_at", periodStart);

    return request;
  };

  let page = query.page;
  let { data, count, error } = await read(page);

  if (error?.code === RANGE_NOT_SATISFIABLE && page > 1) {
    page = 1;
    ({ data, count, error } = await read(page));
  }
  if (error) throw error;

  const { airport } = await getBookingImportLookups(supabase);

  return {
    items: ((data ?? []) as unknown as ImportRow[]).map((row) => ({
      id: row.id,
      file_name: row.file_name,
      partner_name: row.partner?.name ?? null,
      actor_name: row.actor?.full_name ?? null,
      created_at: row.created_at,
      created_rows: row.created_rows,
      rejected_rows: row.rejected_rows,
    })),
    total: count ?? 0,
    page,
    timezone: airport?.timezone ?? "UTC",
  };
}

/** Server-only. The partners and the people of the filter: every partner, and those who ran an import. */
export async function getBookingImportFilterOptions(): Promise<BookingImportFilterOptions> {
  const supabase = await createClient();
  const [partners, importers] = await Promise.all([
    supabase.from("partners").select("id, name").order("name", { ascending: true }),
    supabase
      .from("booking_imports")
      .select("created_by, actor:users!booking_imports_created_by_fkey(full_name)")
      .not("created_by", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  for (const { error } of [partners, importers]) {
    if (error) throw error;
  }

  const actors = new Map<string, string>();
  for (const row of (importers.data ?? []) as unknown as { created_by: string; actor: { full_name: string } | null }[]) {
    if (row.actor && !actors.has(row.created_by)) actors.set(row.created_by, row.actor.full_name);
  }

  return {
    partners: (partners.data ?? []).map((partner) => ({ value: partner.id, label: partner.name })),
    actors: [...actors].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}
