import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";

interface FlightsLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the `(dashboard)` layout already provides `AppShell`. The Flight board is for the roles that
 * hold `dashboards:view` (admin and operations manager, VI-F02-S08); any other role gets a 403 inside the shell.
 */
export default async function FlightsLayout({ children }: FlightsLayoutProps) {
  await requirePermission("dashboards:view");

  return <>{children}</>;
}
