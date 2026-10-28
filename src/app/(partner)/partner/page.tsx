import { requirePartnerScope } from "@/lib/auth/current-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PartnerOverview } from "@/features/partners/components/partner-overview";
import { getUpcomingPartnerRentals } from "@/features/partners/lib/get-upcoming-partner-rentals";
import { getPartnerSummary } from "@/features/partners/lib/get-partner-summary";

function formatMonth(): string {
  return new Date().toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface HeadingProps {
  title: string;
  subtitle: string;
}

function Heading({ title, subtitle }: HeadingProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
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
 * partner's id cannot be reached from here. The layout is the Partner Overview
 * of the design (UI-F06-S04). An account
 * with no partner never gets here: `requirePartnerScope` sends it to the
 * no-partner page (spec E2).
 */
export default async function PartnerPage() {
  const user = await requirePartnerScope("bookings:view_own_partner");

  const [summary, upcoming] = await Promise.all([
    getPartnerSummary(user.partner_id),
    getUpcomingPartnerRentals(),
  ]);

  if (summary === null) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-8">
        <Heading title="Partner Overview" subtitle="Your organization." />
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
        title="Partner Overview"
        subtitle={`${summary.name} · ${summary.code} · ${formatMonth()} · Your partner data only`}
      />
      <PartnerOverview upcoming={upcoming} />
    </div>
  );
}
