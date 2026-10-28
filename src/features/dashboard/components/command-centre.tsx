import { FlightBanners } from "@/features/dashboard/components/flight-banners";
import { OperationalAttention } from "@/features/dashboard/components/operational-attention";
import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import { StatusChart } from "@/features/dashboard/components/status-chart";
import { StockByCategory } from "@/features/dashboard/components/stock-by-category";
import type { FlightAlertItem } from "@/features/dashboard/lib/get-flight-alerts";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";
import type { BarItem } from "@/lib/charts/bar-data";

interface CommandCentreProps {
  charts: readonly DashboardChartResult[];
  flightAlerts: readonly FlightAlertItem[];
  stock: readonly BarItem[] | null;
}

/**
 * The Command Centre as the design draws it (UI-F06-S04): the tiles, the flight banners, the status charts
 * side by side, the incidents and the stock, and the queues. The tiles have a dash until their formulas are
 * built (another ticket). A chart shows only for a role that may see its figures.
 */
export function CommandCentre({
  charts,
  flightAlerts,
  stock,
}: CommandCentreProps) {
  const chart = (id: string) => charts.find((result) => result.chart.id === id);
  const seats = chart("seats_by_status");
  const bookings = chart("bookings_by_status");
  const jobs = chart("jobs_by_status");
  const incidents = chart("open_incidents_by_severity");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewTile label="Arrivals today" />
        <OverviewTile label="Installations due" />
        <OverviewTile label="Active rentals" />
        <OverviewTile label="Overdue tasks" />
      </div>

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
        {seats && <StockByCategory items={stock} />}
      </div>

      <OperationalAttention />
    </div>
  );
}
