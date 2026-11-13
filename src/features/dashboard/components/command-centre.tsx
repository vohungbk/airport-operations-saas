import { PageEmpty } from "@/components/shared/page-state";
import { isNothingToAttend } from "@/features/dashboard/lib/command-centre-state";
import { FlightBanners } from "@/features/dashboard/components/flight-banners";
import { OperationalAttention } from "@/features/dashboard/components/operational-attention";
import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import { StatusChart } from "@/features/dashboard/components/status-chart";
import { StockByCategory } from "@/features/dashboard/components/stock-by-category";
import { OVERDUE_JOBS_HREF } from "@/features/dashboard/lib/get-overdue-jobs";
import type { ActiveReturned } from "@/features/dashboard/lib/get-active-returned";
import type { AllocationQueue, AllocationQueues } from "@/features/dashboard/lib/get-allocation-queues";
import type { ArrivalQueues } from "@/features/dashboard/lib/get-arrival-queues";
import type { FlightAlertItem } from "@/features/dashboard/lib/get-flight-alerts";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";
import type { AttentionList } from "@/features/dashboard/lib/attention-list";
import type { StockCategory } from "@/features/dashboard/lib/stock-rows";

interface CommandCentreProps {
  charts: readonly DashboardChartResult[];
  flightAlerts: readonly FlightAlertItem[];
  stock: readonly StockCategory[] | null;
  /** When the page counted its figures. */
  loadedAt: Date;
  /** Jobs past their deadline and not done; `null` when it could not be read (a dash). */
  overdueTasks?: number | null;
  /** Bookings not cancelled that arrive today at their airport; `null` when it could not be read. */
  arrivalsToday?: number | null;
  /** Bookings with pickup today that have no installation record; `null` when it could not be read. */
  installationsDue?: number | null;
  /** Today's arrivals and the upcoming bookings for the attention table; `null` when they could not be read. */
  arrivalQueues?: ArrivalQueues | null;
  /** Seats to allocate, installations due and seats in cleaning and inspection; `null` when they could not be read. */
  allocationQueues?: AllocationQueues | null;
  /** Active rentals and returned seats with counts; `null` when they could not be read. */
  activeReturned?: ActiveReturned | null;
  /** Seats damaged or in quarantine with their count; `null` when they could not be read. */
  quarantineQueue?: AllocationQueue | null;
  /** The overdue jobs, longest overdue first; `null` when they could not be read. */
  overdueList?: AttentionList | null;
  /** The open incidents, most severe first; `null` when they could not be read. */
  openIncidents?: AttentionList | null;
  /** The open jobs with their technician and deadline; `null` when they could not be read. */
  technicianAssignments?: AttentionList | null;
}

/**
 * The Command Centre as the design draws it (UI-F06-S04): the tiles, the flight banners, the status charts
 * side by side, the incidents and the stock, and the queues. Arrivals today and Installations due have their
 * numbers from the KPI figures (VI-F05-T02) and Overdue tasks from the rule of the jobs list; a figure that
 * could not be read, and Active rentals, show a dash. A chart shows only for a role that may see its figures.
 */
export function CommandCentre({
  charts,
  flightAlerts,
  stock,
  loadedAt,
  overdueTasks = null,
  arrivalsToday = null,
  installationsDue = null,
  arrivalQueues = null,
  allocationQueues = null,
  activeReturned = null,
  quarantineQueue = null,
  overdueList = null,
  openIncidents = null,
  technicianAssignments = null,
}: CommandCentreProps) {
  const chart = (id: string) => charts.find((result) => result.chart.id === id);
  const seats = chart("seats_by_status");
  const bookings = chart("bookings_by_status");
  const jobs = chart("jobs_by_status");
  const incidents = chart("open_incidents_by_severity");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewTile label="Arrivals today" value={arrivalsToday ?? undefined} />
        <OverviewTile label="Installations due" value={installationsDue ?? undefined} />
        <OverviewTile label="Active rentals" />
        <OverviewTile
          label="Overdue tasks"
          value={overdueTasks ?? undefined}
          href={overdueTasks === null ? undefined : OVERDUE_JOBS_HREF}
        />
      </div>

      {isNothingToAttend({
        arrivalsToday,
        installationsDue,
        overdueTasks,
        flightAlertCount: flightAlerts.length,
      }) && <PageEmpty message="Nothing needs attention today." />}

      <FlightBanners alerts={flightAlerts} />

      {(seats || bookings || jobs) && (
        <div className="grid gap-6 lg:grid-cols-3">
          {seats && <StatusChart result={seats} variant="donut" />}
          {bookings && <StatusChart result={bookings} variant="bars" />}
          {jobs && <StatusChart result={jobs} variant="bars" />}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {incidents && <StatusChart result={incidents} variant="stacked" />}
        {seats && <StockByCategory items={stock} loadedAt={loadedAt} />}
      </div>

      <OperationalAttention
        arrivalQueues={arrivalQueues}
        allocationQueues={allocationQueues}
        activeReturned={activeReturned}
        quarantineQueue={quarantineQueue}
        overdueList={overdueList}
        openIncidents={openIncidents}
        technicianAssignments={technicianAssignments}
      />
    </div>
  );
}
