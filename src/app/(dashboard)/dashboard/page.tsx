import { redirect } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { DASHBOARD_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { CommandCentre } from "@/features/dashboard/components/command-centre";
import { getDashboardCharts } from "@/features/dashboard/lib/get-dashboard-charts";
import { getFlightAlerts } from "@/features/dashboard/lib/get-flight-alerts";
import { getStockByCategory } from "@/features/dashboard/lib/get-stock-by-category";
import { PARTNER_HOME_ROUTE } from "@/lib/constants/routes";

function formatToday(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Heading() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Command Centre
      </h1>
      <p className="text-sm text-muted-foreground">
        Live operations · {formatToday()}
      </p>
    </div>
  );
}

/**
 * The landing page after sign-in: the Command Centre of the design (UI-F06-S04). `requireAnyPermission` is
 * the access check (managers, technicians and partner users may open it); each role sees the charts of the
 * lists it can open, over the rows its RLS scope returns. A partner user does not stay here: their home is
 * the partner home (VI-F03-S01).
 */
export default async function DashboardPage() {
  const user = await requireAnyPermission(DASHBOARD_ACCESS_PERMISSIONS);

  if (user.role === "partner_user") {
    redirect(PARTNER_HOME_ROUTE);
  }

  const [charts, flightAlerts, stock] = await Promise.all([
    getDashboardCharts(user.role),
    getFlightAlerts(),
    getStockByCategory(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Heading />
      <CommandCentre
        charts={charts}
        flightAlerts={flightAlerts}
        stock={stock}
      />
    </div>
  );
}
