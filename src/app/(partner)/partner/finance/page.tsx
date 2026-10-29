import { requirePartnerScope } from "@/lib/auth/current-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageEmpty } from "@/components/shared/page-state";
import { PartnerFinance } from "@/features/partners/components/partner-finance";
import { getPartnerFinance } from "@/features/partners/lib/get-partner-finance";
import { getPartnerSummary } from "@/features/partners/lib/get-partner-summary";
import { buildPartnerFinance } from "@/features/partners/lib/partner-finance";

interface HeadingProps {
  subtitle: string;
}

function Heading({ subtitle }: HeadingProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Partner Finance
      </h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/**
 * The partner finance screen (VI-F04-S14). `finance:view_own_partner` is guarded here and
 * `bookings:view_own_partner` by the layout; a user without it gets the 403 of the shell. The scope is
 * never taken from the request: the partner is the one on the signed-in user's own profile and every
 * read goes through RLS, so another partner's figures cannot be reached from here. An account with no
 * partner never gets here: `requirePartnerScope` sends it to the no-partner page. A failed read is
 * thrown to the error boundary, never shown as an empty screen.
 */
export default async function PartnerFinancePage() {
  const user = await requirePartnerScope("finance:view_own_partner");

  const [summary, finance] = await Promise.all([
    getPartnerSummary(user.partner_id),
    getPartnerFinance(),
  ]);

  if (summary === null) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-8">
        <Heading subtitle="Read-only finance workspace" />
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

  const view = buildPartnerFinance(finance);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Heading subtitle={`${summary.name} only · Read-only finance workspace`} />

      {view.is_empty ? (
        <PageEmpty message="No finance records yet. Settlements and invoices appear here once they are issued to your organization." />
      ) : (
        <PartnerFinance view={view} />
      )}
    </div>
  );
}
