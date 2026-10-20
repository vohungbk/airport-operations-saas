import { requireAnyPermission } from "@/lib/auth/current-user";
import { DASHBOARD_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageEmpty } from "@/components/shared/page-state";
import { DashboardRetryButton } from "@/features/dashboard/components/dashboard-retry-button";
import { DashboardMetricsGrid } from "@/features/dashboard/components/dashboard-metrics-grid";
import {
  getDashboardState,
  hasUnreleasedMetrics,
  isUnlinkedPartner,
} from "@/features/dashboard/lib/dashboard-state";
import { getDashboardMetrics } from "@/features/dashboard/lib/get-dashboard-metrics";

function Heading() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>
      <p className="text-sm text-muted-foreground">
        Counts for what you can see, as of now.
      </p>
    </div>
  );
}

/**
 * The landing page after sign-in. `requireAnyPermission` is the access check
 * (managers, technicians and partner users may open it); each role sees the
 * metrics of the lists it can open, over the rows its RLS scope returns, and
 * every tile links to the list it counts. Values come from count queries when
 * the page loads, never from a stored or hardcoded number. Gaps are said out
 * loud: a figure that could not be read is Unavailable, a module that is not
 * released is Not available yet, and a partner user with no partner gets a
 * note instead of a screen of zeros. None of them is shown as 0. When figures
 * could not be read, the note offers a retry that counts them again.
 */
export default async function DashboardPage() {
  const user = await requireAnyPermission(DASHBOARD_ACCESS_PERMISSIONS);

  if (isUnlinkedPartner(user)) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-8">
        <Heading />
        <Alert>
          <AlertTitle>Your account is not linked to a partner yet</AlertTitle>
          <AlertDescription>
            There is nothing to show until it is linked. Ask an administrator
            to link your account to your partner.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const results = await getDashboardMetrics(user.role);
  const state = getDashboardState(results);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Heading />

      {(state === "partial" || state === "unavailable") && (
        <Alert variant="destructive">
          <AlertTitle>Some figures are unavailable</AlertTitle>
          <AlertDescription>
            {state === "unavailable"
              ? "None of the figures could be read right now."
              : "Some figures could not be read and are marked Unavailable. The others are up to date."}
          </AlertDescription>
          <div className="mt-2">
            <DashboardRetryButton />
          </div>
        </Alert>
      )}

      {hasUnreleasedMetrics(results) && (
        <Alert>
          <AlertTitle>Some figures are not available yet</AlertTitle>
          <AlertDescription>
            Some parts of the system are not released yet. Their figures are
            marked Not available yet and are not counted.
          </AlertDescription>
        </Alert>
      )}

      {state === "empty" ? (
        <PageEmpty message="No operational data yet. Figures appear here once there are seats, bookings, jobs or incidents." />
      ) : (
        <DashboardMetricsGrid results={results} />
      )}
    </div>
  );
}
