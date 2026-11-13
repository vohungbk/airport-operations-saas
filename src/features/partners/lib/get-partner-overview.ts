import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getCoreKpis } from "@/lib/kpi/get-core-kpis";
import { getTodayFigures } from "@/lib/kpi/get-kpi-figures";
import { currentMonthParam, resolveKpiPeriod } from "@/lib/kpi/kpi-period";
import type { Database } from "@/types/database.types";
import { countMetric } from "@/features/dashboard/lib/get-dashboard-metrics";
import { getPartnerFinance } from "@/features/partners/lib/get-partner-finance";
import { NOT_STARTED_BOOKING_STATUSES } from "@/features/partners/lib/get-upcoming-partner-rentals";
import {
  buildPartnerOverview,
  type PartnerOverviewInputs,
  type PartnerOverviewView,
} from "@/features/partners/lib/partner-overview";

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS = 7;

/** One failed read leaves a dash in its own figure; it never fails the whole overview. */
async function orNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

async function countRows(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number | null> {
  const { count, error } = await query;

  return error ? null : count;
}

function countUpcoming(supabase: SupabaseClient<Database>, now: Date): Promise<number | null> {
  return countRows(
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("pickup_at", now.toISOString())
      .lt("pickup_at", new Date(now.getTime() + UPCOMING_DAYS * DAY_MS).toISOString())
      .in("status", NOT_STARTED_BOOKING_STATUSES),
  );
}

function countResolvedIncidents(
  supabase: SupabaseClient<Database>,
  period: { from: string; to: string },
): Promise<number | null> {
  return countRows(
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .gte("resolved_at", period.from)
      .lt("resolved_at", period.to),
  );
}

/**
 * Server-only (VI-F11-S10). The Partner Overview of the signed-in user, read with the user's own client:
 * RLS gives a partner user only the rows of its own partner, so no partner id is sent from here. The month
 * is the month of `now`. Every figure is read on its own, so one that fails shows a dash and the rest load.
 */
export async function getPartnerOverview(now: Date = new Date()): Promise<PartnerOverviewView> {
  const supabase = await createClient();
  const resolved = resolveKpiPeriod(currentMonthParam(now), now);
  const period = resolved.ok ? resolved.period : null;

  const [today, yesterday, active, upcoming, familyReady, awaiting, resolvedIncidents, core, finance] =
    await Promise.all([
      getTodayFigures(now, supabase),
      getTodayFigures(new Date(now.getTime() - DAY_MS), supabase),
      orNull(() => countMetric(supabase, { source: "bookings", filters: { status: "in_progress" } })),
      orNull(() => countUpcoming(supabase, now)),
      orNull(() => countMetric(supabase, { source: "bookings", filters: { status: "family_ready" } })),
      orNull(() => countMetric(supabase, { source: "bookings", filters: { status: "assigned" } })),
      period ? orNull(() => countResolvedIncidents(supabase, period)) : null,
      period ? orNull(() => getCoreKpis(period, supabase)) : null,
      orNull(() => getPartnerFinance()),
    ]);

  const inputs: PartnerOverviewInputs = {
    rentals_today: today.arrivals_today,
    rentals_yesterday: yesterday.arrivals_today,
    active_rentals: active,
    upcoming_reservations: upcoming,
    family_ready: familyReady,
    awaiting_installation: awaiting,
    resolved_incidents: resolvedIncidents,
    core: core?.ok ? core.kpis : null,
    finance,
  };

  return buildPartnerOverview(inputs, now);
}
