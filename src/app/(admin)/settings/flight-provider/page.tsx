import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/current-user";
import { ProviderStatusCard } from "@/features/flights/components/provider-status-card";
import { getProviderStatus } from "@/features/flights/lib/get-provider-status";

/**
 * VI-F02-S09 (spec S4, R5): the active flight source and its status, and (when that source is the simulator) the way into the
 * Flight simulator (VI-F02-S12). A second `requireRole`
 * alongside the layout's (defense in depth). Loading is `loading.tsx`, the error state is
 * `error.tsx`, and a role other than admin gets a 403 from the guard.
 */
export default async function FlightProviderPage() {
  await requireRole(["admin"]);

  const status = await getProviderStatus();

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Provider settings</h1>
      <ProviderStatusCard status={status} />
      {status.source === "simulator" && (
        <div>
          <Link href="/settings/flight-simulator" className={buttonVariants({ variant: "outline" })}>
            Open flight simulator
          </Link>
        </div>
      )}
    </div>
  );
}
