import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";

interface KpiLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the `(dashboard)` layout already provides `AppShell`. Admin and operations manager
 * (`dashboards:view`) may enter; technicians and partner users get the 403 of the shell (a partner user
 * has their own KPI dashboard at `/partner/kpi`).
 */
export default async function KpiLayout({ children }: KpiLayoutProps) {
  await requirePermission("dashboards:view");

  return <>{children}</>;
}
