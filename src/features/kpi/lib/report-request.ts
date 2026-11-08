import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { getCurrentUser, type AppUser } from "@/lib/auth/current-user";
import { getPartnerAccessIssue } from "@/lib/auth/partner-scope";
import { hasPermission } from "@/lib/auth/permissions";
import { getPartnerSummary } from "@/features/partners/lib/get-partner-summary";
import { resolveKpiPeriod, type ResolvedKpiPeriod } from "@/lib/kpi/kpi-period";
import { parseKpiSearch } from "@/lib/kpi/kpi-search";

export type ReportRequest =
  | {
      ok: true;
      user: AppUser;
      /** The partner of the signed-in user, or `null` for the internal team, whose scope is every partner. */
      partner_id: string | null;
      scope_label: string;
      period: ResolvedKpiPeriod;
      compare_on: boolean;
      query: string;
      now: Date;
    }
  | { ok: false; response: NextResponse };

const first = (value: string | null) => value ?? undefined;

/**
 * VI-F05-T03. The checks every report shares, in the order of the dashboards: the caller is signed in, holds the
 * permission of the dashboard (`bookings:view_own_partner` for a partner user, `dashboards:view` for the
 * internal team) and, for a partner user, has an active partner. The scope is never taken from the address: a
 * partner user gets the partner of its own profile, and RLS decides the rows. The period and the search are
 * validated, like on the screen. A failure is the standardized error shape.
 */
export async function resolveReportRequest(request: Request, now: Date = new Date()): Promise<ReportRequest> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: apiError("UNAUTHORIZED", "Sign in to export the report.") };
  }

  const isPartner = user.role === "partner_user";
  const permitted = hasPermission(user.role, isPartner ? "bookings:view_own_partner" : "dashboards:view");
  if (!permitted || getPartnerAccessIssue(user) !== null || (isPartner && user.partner_id === null)) {
    return { ok: false, response: apiError("FORBIDDEN", "You cannot export this report.") };
  }

  const params = new URL(request.url).searchParams;
  const resolved = resolveKpiPeriod(first(params.get("period")), now);
  if (!resolved.ok) {
    return {
      ok: false,
      response: apiError("VALIDATION_ERROR", resolved.message, [{ field: "period", issue: resolved.message }]),
    };
  }

  const partner_id = isPartner ? user.partner_id : null;
  const scope_label = partner_id ? ((await getPartnerSummary(partner_id))?.name ?? "Your partner") : "All partners";

  return {
    ok: true,
    user,
    partner_id,
    scope_label,
    period: resolved.period,
    compare_on: params.get("compare") !== "off",
    query: parseKpiSearch(first(params.get("q"))),
    now,
  };
}

/** The file of a report as a download; it is private to the caller and never cached. */
export function reportResponse(csv: string, file_name: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file_name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Who exported, as the file says it. */
export const exportedBy = (user: Pick<AppUser, "full_name" | "email">) => user.full_name || user.email;
