import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import {
  correctSeatFigure,
  onTimeReadinessFigure,
  type KpiFigure,
} from "@/lib/kpi/kpi-figures";
import { kpiPeriodSchema } from "@/lib/kpi/kpi-period.schema";
import type { Database } from "@/types/database.types";

/**
 * Server-only. Reads the KPI functions as the signed-in user, so RLS is the scope: admin and operations
 * see every row, a partner user only the rows of their partner (VI-F05-T02, AC08). The Command Centre,
 * the export and the assistant call these, so they cannot disagree (AC09). A read that fails gives
 * `null`, never a made-up 0.
 */

export interface TodayFigures {
  arrivals_today: number | null;
  installations_due: number | null;
}

export interface RateFigures {
  correct_seat: KpiFigure;
  on_time_readiness: KpiFigure;
}

export type RateFiguresResult =
  | { ok: true; figures: RateFigures }
  | { ok: false; reason: "invalid_period"; message: string }
  | { ok: false; reason: "unavailable" };

/** The count columns of a function row as numbers; PostgREST may send a bigint as a string. */
export function counts<K extends string>(row: Record<K, number | string>): Record<K, number> {
  const entries = Object.entries<number | string>(row).map(([key, value]) => [key, Number(value)]);

  return Object.fromEntries(entries) as Record<K, number>;
}

/** Arrivals today and Installations due, for the calendar day of `now` at each booking's airport. */
export async function getTodayFigures(
  now: Date = new Date(),
  supabase?: SupabaseClient<Database>,
): Promise<TodayFigures> {
  try {
    const client = supabase ?? (await createClient());
    const { data, error } = await client.rpc("kpi_today_figures", { p_now: now.toISOString() });
    const row = data?.[0];

    if (error || !row) return { arrivals_today: null, installations_due: null };

    return counts(row);
  } catch {
    return { arrivals_today: null, installations_due: null };
  }
}

/** Correct-seat fulfilment and On-time readiness for `[from, to)`. The period is validated here too. */
export async function getRateFigures(
  period: { from: string; to: string },
  supabase?: SupabaseClient<Database>,
): Promise<RateFiguresResult> {
  const parsed = kpiPeriodSchema.safeParse(period);

  if (!parsed.success) {
    return { ok: false, reason: "invalid_period", message: parsed.error.issues[0]?.message ?? "Invalid period" };
  }

  try {
    const client = supabase ?? (await createClient());
    const args = { p_from: parsed.data.from, p_to: parsed.data.to };
    const [seat, readiness] = await Promise.all([
      client.rpc("kpi_correct_seat_figures", args),
      client.rpc("kpi_on_time_readiness_figures", args),
    ]);
    const seatRow = seat.data?.[0];
    const readinessRow = readiness.data?.[0];

    if (seat.error || readiness.error || !seatRow || !readinessRow) return { ok: false, reason: "unavailable" };

    return {
      ok: true,
      figures: {
        correct_seat: correctSeatFigure(counts(seatRow)),
        on_time_readiness: onTimeReadinessFigure(counts(readinessRow)),
      },
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
