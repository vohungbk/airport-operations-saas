import { requirePartnerScope } from "@/lib/auth/current-user";
import { RoiDashboard } from "@/features/roi/components/roi-dashboard";
import { PARTNER_BASELINE_ROUTE } from "@/lib/constants/routes";
import { getPartnerSummary } from "@/features/partners/lib/get-partner-summary";

interface PartnerRoiPageProps {
  searchParams: Promise<{ period?: string | string[]; compare?: string | string[]; q?: string | string[] }>;
}

/**
 * The ROI dashboard of a partner (VI-F05-S04). `bookings:view_own_partner` is guarded here and by the
 * layout; another role gets the 403 of the shell. The scope is never taken from the request: the partner
 * is the one on the signed-in user's own profile and every figure is read through RLS, so another
 * partner's figures cannot be reached from here. The period is the only input, and it is validated.
 */
export default async function PartnerRoiPage({ searchParams }: PartnerRoiPageProps) {
  const user = await requirePartnerScope("bookings:view_own_partner");
  const [summary, { period, compare, q }] = await Promise.all([getPartnerSummary(user.partner_id), searchParams]);

  return (
    <RoiDashboard
      scope_label={summary?.name ?? "Your partner"}
      scope_note="Your partner data only"
      edit_baseline_href={PARTNER_BASELINE_ROUTE}
      period={Array.isArray(period) ? period[0] : period}
      compare={Array.isArray(compare) ? compare[0] : compare}
      q={Array.isArray(q) ? q[0] : q}
    />
  );
}
