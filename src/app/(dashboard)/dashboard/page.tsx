import { redirect } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { DASHBOARD_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { CommandCentre } from "@/features/dashboard/components/command-centre";
import { CommandCentreHeading } from "@/features/dashboard/components/command-centre-heading";
import { getAllocationQueues } from "@/features/dashboard/lib/get-allocation-queues";
import { getArrivalQueues } from "@/features/dashboard/lib/get-arrival-queues";
import { getDashboardCharts } from "@/features/dashboard/lib/get-dashboard-charts";
import { getFlightAlerts } from "@/features/dashboard/lib/get-flight-alerts";
import { getOverdueJobsCount } from "@/features/dashboard/lib/get-overdue-jobs";
import { getStockByCategory } from "@/features/dashboard/lib/get-stock-by-category";
import { PARTNER_HOME_ROUTE } from "@/lib/constants/routes";
import { getTodayFigures } from "@/lib/kpi/get-kpi-figures";

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

  const loadedAt = new Date();
  const [charts, flightAlerts, stock, overdueTasks, today, arrivalQueues, allocationQueues] = await Promise.all([
    getDashboardCharts(user.role),
    getFlightAlerts(),
    getStockByCategory(),
    getOverdueJobsCount(),
    getTodayFigures(),
    getArrivalQueues(),
    getAllocationQueues(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <CommandCentreHeading loadedAt={loadedAt} />
      <CommandCentre
        charts={charts}
        flightAlerts={flightAlerts}
        stock={stock}
        overdueTasks={overdueTasks}
        arrivalsToday={today.arrivals_today}
        installationsDue={today.installations_due}
        arrivalQueues={arrivalQueues}
        allocationQueues={allocationQueues}
      />
    </div>
  );
}
