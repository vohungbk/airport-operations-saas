import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api/response";
import { buildKpiReportRows } from "@/features/kpi/lib/kpi-report-rows";
import { buildReportCsv, reportFileName } from "@/features/kpi/lib/report-csv";
import { exportedBy, reportResponse, resolveReportRequest } from "@/features/kpi/lib/report-request";
import { getAdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import { getCoreKpis } from "@/lib/kpi/get-core-kpis";
import { previousKpiPeriod } from "@/lib/kpi/kpi-period";

/**
 * VI-F05-T03: the KPI dashboard as a CSV download, for the period and the search of the screen. The figures are
 * the ones of the dashboard (same reads, same tile builders), read through RLS for the signed-in user, so a
 * partner user gets only its own partner's data. A failed read is the standardized error, never a file with
 * made-up figures.
 */
export async function GET(request: NextRequest) {
  const resolved = await resolveReportRequest(request);
  if (!resolved.ok) return resolved.response;

  const { user, scope_label, period, compare_on, query, now } = resolved;
  const previousPeriod = previousKpiPeriod(period);

  try {
    const [core, additional, previous] = await Promise.all([
      getCoreKpis({ from: period.from, to: period.to }),
      getAdditionalKpis({ from: period.from, to: period.to }),
      compare_on ? getCoreKpis({ from: previousPeriod.from, to: previousPeriod.to }) : null,
    ]);
    if (!core.ok || !additional.ok) throw new Error("Could not load the KPIs");

    const { rows, is_empty } = buildKpiReportRows({
      kpis: core.kpis,
      additional: additional.kpis,
      previous: previous?.ok ? previous.kpis : null,
      period_label: period.label,
      query,
    });
    const csv = buildReportCsv(
      { title: "KPI report", scope_label, period_label: period.label, exported_at: now.toISOString(), exported_by: exportedBy(user) },
      rows,
      is_empty,
    );

    return reportResponse(csv, reportFileName("kpi", period.param));
  } catch {
    return apiError("INTERNAL_ERROR", "The report could not be exported. Please try again.");
  }
}
