import { requireRole } from "@/lib/auth/current-user";
import { FlightSimulatorForm } from "@/features/flights/components/flight-simulator-form";
import { getProviderStatus } from "@/features/flights/lib/get-provider-status";

/**
 * VI-F02-S12 (spec S3): create a test flight change for a demonstration or a test. A second `requireRole`
 * alongside the layout's (defense in depth). Loading is `loading.tsx`, the error state is `error.tsx`, and a
 * role other than admin gets a 403 from the guard. The form is off when the active source is not the simulator.
 */
export default async function FlightSimulatorPage() {
  await requireRole(["admin"]);

  const { source } = await getProviderStatus();

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Flight simulator</h1>
      <div className="max-w-lg">
        <FlightSimulatorForm enabled={source === "simulator"} />
      </div>
    </div>
  );
}
