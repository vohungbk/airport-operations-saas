import { requirePartnerScope } from "@/lib/auth/current-user";
import { KpiDashboard } from "@/features/kpi/components/kpi-dashboard";
import { getPartnerSummary } from "@/features/partners/lib/get-partner-summary";

interface PartnerKpiPageProps {
  searchParams: Promise<{ period?: string | string[]; compare?: string | string[]; q?: string | string[] }>;
}

/**
 * The KPI dashboard of a partner (VI-F05-S01). `bookings:view_own_partner` is guarded here and by the
 * layout; another role gets the 403 of the shell. The scope is never taken from the request: the partner
 * is the one on the signed-in user's own profile and every figure is read through RLS, so another
 * partner's figures cannot be reached from here. The period is the only input, and it is validated.
 */
export default async function PartnerKpiPage({ searchParams }: PartnerKpiPageProps) {
  const user = await requirePartnerScope("bookings:view_own_partner");
  const [summary, { period, compare, q }] = await Promise.all([getPartnerSummary(user.partner_id), searchParams]);

  return (
    <KpiDashboard
      scope_label={summary?.name ?? "Your partner"}
      period={Array.isArray(period) ? period[0] : period}
      compare={Array.isArray(compare) ? compare[0] : compare}
      q={Array.isArray(q) ? q[0] : q}
    />
  );
}
