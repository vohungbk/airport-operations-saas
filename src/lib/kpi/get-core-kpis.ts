import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { counts, getRateFigures } from "@/lib/kpi/get-kpi-figures";
import { kpiPeriodSchema } from "@/lib/kpi/kpi-period.schema";
import {
  commercialFigure,
  incidentsFigure,
  traceabilityFigure,
  type AmountFigure,
  type IncidentsFigure,
  type KpiFigure,
} from "@/lib/kpi/kpi-figures";
import type { Database } from "@/types/database.types";

/**
 * Server-only. The five core KPIs of the KPI dashboard for `[from, to)` (VI-F05-S01, R1): the two rates of
 * VI-F05-T02 and the three of this story. Every figure is read as the signed-in user, so RLS is the scope:
 * a partner user gets the rows of their own partner, admin and operations manager every partner. A read
 * that fails gives `ok: false`, so the page can show its error state instead of a made-up number.
 */

export interface CoreKpis {
  correct_seat: KpiFigure;
  family_ready_on_time: KpiFigure;
  traceability: KpiFigure;
  incidents: IncidentsFigure;
  commercial: AmountFigure;
}

export type CoreKpisResult =
  | { ok: true; kpis: CoreKpis }
  | { ok: false; reason: "invalid_period" | "unavailable" };

export async function getCoreKpis(
  period: { from: string; to: string },
  supabase?: SupabaseClient<Database>,
): Promise<CoreKpisResult> {
  if (!kpiPeriodSchema.safeParse(period).success) return { ok: false, reason: "invalid_period" };

  try {
    const client = supabase ?? (await createClient());
    const args = { p_from: period.from, p_to: period.to };
    const [rates, traceability, incidents, commercial] = await Promise.all([
      getRateFigures(period, client),
      client.rpc("kpi_traceability_figures", args),
      client.rpc("kpi_incident_figures", args),
      client.rpc("kpi_commercial_figures", args),
    ]);

    if (!rates.ok) return { ok: false, reason: rates.reason };

    const traceabilityRow = traceability.data?.[0];
    const incidentsRow = incidents.data?.[0];
    const commercialRow = commercial.data?.[0];

    if (traceability.error || incidents.error || commercial.error || !traceabilityRow || !incidentsRow || !commercialRow) {
      return { ok: false, reason: "unavailable" };
    }

    return {
      ok: true,
      kpis: {
        correct_seat: rates.figures.correct_seat,
        family_ready_on_time: rates.figures.on_time_readiness,
        traceability: traceabilityFigure(counts(traceabilityRow)),
        incidents: incidentsFigure(counts(incidentsRow)),
        commercial: commercialFigure(counts(commercialRow)),
      },
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
