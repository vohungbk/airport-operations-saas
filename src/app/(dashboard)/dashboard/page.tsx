import { redirect } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { DASHBOARD_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { DashboardFigures } from "@/features/dashboard/components/dashboard-figures";
import { getDashboardMetrics } from "@/features/dashboard/lib/get-dashboard-metrics";
import { PARTNER_HOME_ROUTE } from "@/lib/constants/routes";

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
 * released is Not available yet. None of them is shown as 0. When figures
 * could not be read, the note offers a retry that counts them again. A partner
 * user does not stay here: their home is the partner home (VI-F03-S01).
 */
export default async function DashboardPage() {
  const user = await requireAnyPermission(DASHBOARD_ACCESS_PERMISSIONS);

  if (user.role === "partner_user") {
    redirect(PARTNER_HOME_ROUTE);
  }

  const results = await getDashboardMetrics(user.role);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Heading />
      <DashboardFigures results={results} />
    </div>
  );
}
