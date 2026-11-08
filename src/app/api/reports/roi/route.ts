import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api/response";
import { buildReportCsv, reportFileName } from "@/features/kpi/lib/report-csv";
import { exportedBy, reportResponse, resolveReportRequest } from "@/features/kpi/lib/report-request";
import { getBaselineInputs } from "@/features/roi/lib/get-baseline-inputs";
import { readTrendMonths } from "@/features/roi/lib/read-trend-months";
import { buildRoiReportRows } from "@/features/roi/lib/roi-report-rows";
import { getAdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import { getCoreKpis } from "@/lib/kpi/get-core-kpis";
import { monthsInPeriod } from "@/lib/kpi/kpi-period";

/**
 * VI-F05-T03: the ROI dashboard as a CSV download, for the period and the search of the screen. The verified
 * results and the estimates come from the builders of the dashboard, so the values equal the screen; every
 * estimate is marked Estimate and kept apart. The baseline is the one of the partner on the signed-in user's
 * profile (the internal team has none), and every figure is read through RLS.
 */
export async function GET(request: NextRequest) {
  const resolved = await resolveReportRequest(request);
  if (!resolved.ok) return resolved.response;

  const { user, partner_id, scope_label, period, query, now } = resolved;

  try {
    const [core, additional, baseline] = await Promise.all([
      getCoreKpis({ from: period.from, to: period.to }),
      getAdditionalKpis({ from: period.from, to: period.to }),
      partner_id ? getBaselineInputs(partner_id) : null,
    ]);
    if (!core.ok || !additional.ok) throw new Error("Could not load the ROI report");

    const trend_months = baseline ? await readTrendMonths(period) : [];
    const { rows, is_empty } = buildRoiReportRows({
      core: core.kpis,
      additional: additional.kpis,
      baseline,
      period_label: period.label,
      months: monthsInPeriod(period.param, now),
      trend_months,
      query,
    });
    const csv = buildReportCsv(
      { title: "ROI report", scope_label, period_label: period.label, exported_at: now.toISOString(), exported_by: exportedBy(user) },
      rows,
      is_empty,
    );

    return reportResponse(csv, reportFileName("roi", period.param));
  } catch {
    return apiError("INTERNAL_ERROR", "The report could not be exported. Please try again.");
  }
}
