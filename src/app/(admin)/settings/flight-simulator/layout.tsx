import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/current-user";

interface FlightSimulatorLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the layout of `(admin)` already provides `AppShell`. Only an admin runs the flight
 * simulator (spec 2.1); any other role gets a 403 inside that shell.
 */
export default async function FlightSimulatorLayout({ children }: FlightSimulatorLayoutProps) {
  await requireRole(["admin"]);

  return <>{children}</>;
}
