import { RoiDashboard } from "@/features/roi/components/roi-dashboard";

interface RoiPageProps {
  searchParams: Promise<{ period?: string | string[]; compare?: string | string[]; q?: string | string[] }>;
}

/**
 * The ROI dashboard of the internal team (VI-F05-S04). The layout guards the access. The figures cover
 * every partner, because that is the RLS scope of admin and operations manager.
 */
export default async function RoiPage({ searchParams }: RoiPageProps) {
  const { period, compare, q } = await searchParams;

  return (
    <RoiDashboard
      scope_label="All partners"
      period={Array.isArray(period) ? period[0] : period}
      compare={Array.isArray(compare) ? compare[0] : compare}
      q={Array.isArray(q) ? q[0] : q}
    />
  );
}
