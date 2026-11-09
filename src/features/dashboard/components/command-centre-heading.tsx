import { DashboardRefreshButton } from "@/features/dashboard/components/dashboard-refresh-button";
import { formatClock } from "@/features/flights/lib/flight-panel";
import { formatDate } from "@/features/jobs/lib/job-time";

interface CommandCentreHeadingProps {
  /** When the page counted its figures (the server time of this render). */
  loadedAt: Date;
}

/** The title, the refresh button and the line with the load time of the figures (VI-F11-S01, R14). */
export function CommandCentreHeading({ loadedAt }: CommandCentreHeadingProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-3xl font-semibold tracking-tight text-foreground">
          Command Centre
        </h1>
        <DashboardRefreshButton />
      </div>
      <p className="text-sm text-muted-foreground">
        Live operations · {formatDate(loadedAt, "UTC")} · Loaded {formatClock(loadedAt.toISOString(), "UTC")}
      </p>
    </div>
  );
}
