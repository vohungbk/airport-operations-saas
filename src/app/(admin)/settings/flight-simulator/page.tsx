import { requireRole } from "@/lib/auth/current-user";
import { FlightSimulatorForm } from "@/features/flights/components/flight-simulator-form";
import { formatZoneHeader } from "@/features/flights/lib/flight-board";
import { getProviderStatus } from "@/features/flights/lib/get-provider-status";
import { getDefaultSimulatorAirport } from "@/features/flights/lib/simulator-lookup";
import { formatDate } from "@/features/jobs/lib/job-time";

/**
 * VI-F02-S12 and VI-F02-T02 (spec S3, Figma D7): create a test flight change for a demonstration or a test and see
 * its operational impact before it is applied. A second `requireRole` alongside the layout's (defense in depth).
 * Loading is `loading.tsx`, the error state is `error.tsx`, and a role other than admin gets a 403 from the guard.
 * The form is off when the active source is not the simulator.
 */
export default async function FlightSimulatorPage() {
  await requireRole(["admin"]);

  const [{ source }, airport] = await Promise.all([getProviderStatus(), getDefaultSimulatorAirport()]);
  const now = new Date();

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-display font-semibold text-foreground">Flight simulator</h1>
        {airport && (
          <p className="text-body text-muted-foreground">
            {`${airport.code} · ${airport.name} · ${formatDate(now, airport.timezone)} · ${formatZoneHeader(airport.timezone, now)}`}
          </p>
        )}
      </div>
      <FlightSimulatorForm enabled={source === "simulator"} airport={airport} />
    </div>
  );
}
