import { requirePartnerScope } from "@/lib/auth/current-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardFigures } from "@/features/dashboard/components/dashboard-figures";
import { getDashboardMetrics } from "@/features/dashboard/lib/get-dashboard-metrics";
import { PartnerHomeNav } from "@/features/partners/components/partner-home-nav";
import { getPartnerSummary } from "@/features/partners/lib/get-partner-summary";
import { getPartnerHomeItems } from "@/features/partners/lib/partner-home-items";

interface HeadingProps {
  title: string;
  subtitle: string;
}

function Heading({ title, subtitle }: HeadingProps) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/**
 * The partner home (VI-F03-S01), where a partner user lands after sign-in.
 * The scope is never taken from the request: the partner is the one on the
 * signed-in user's own profile, and every read goes through RLS, so another
 * partner's id cannot be reached from here. The figures are the partner
 * figures of the dashboard (same formulas, same gaps said out loud). An account
 * with no partner never gets here: `requirePartnerScope` sends it to the
 * no-partner page (spec E2).
 */
export default async function PartnerPage() {
  const user = await requirePartnerScope("bookings:view_own_partner");

  const [summary, results] = await Promise.all([
    getPartnerSummary(user.partner_id),
    getDashboardMetrics(user.role),
  ]);

  if (summary === null) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-8">
        <Heading title="Partner home" subtitle="Your organization." />
        <Alert variant="destructive">
          <AlertTitle>Your partner could not be found</AlertTitle>
          <AlertDescription>
            Nothing is shown for it. Contact your administrator if this keeps
            happening.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Heading
        title={summary.name}
        subtitle={`Partner ${summary.code}. Counts for your organization, as of now.`}
      />
      <PartnerHomeNav items={getPartnerHomeItems(user.role)} />
      <DashboardFigures results={results} />
    </div>
  );
}
