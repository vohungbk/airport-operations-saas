import { KpiDashboard } from "@/features/kpi/components/kpi-dashboard";

interface KpiPageProps {
  searchParams: Promise<{ period?: string | string[]; compare?: string | string[]; q?: string | string[] }>;
}

/**
 * The KPI dashboard of the internal team (VI-F05-S01). The layout guards the access. The figures cover
 * every partner, because that is the RLS scope of admin and operations manager.
 */
export default async function KpiPage({ searchParams }: KpiPageProps) {
  const { period, compare, q } = await searchParams;

  return (
    <KpiDashboard
      scope_label="All partners"
      roi_href="/roi"
      period={Array.isArray(period) ? period[0] : period}
      compare={Array.isArray(compare) ? compare[0] : compare}
      q={Array.isArray(q) ? q[0] : q}
    />
  );
}
