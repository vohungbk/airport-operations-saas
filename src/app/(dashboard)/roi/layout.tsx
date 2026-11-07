import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";

interface RoiLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the `(dashboard)` layout already provides `AppShell`. Admin and operations manager
 * (`dashboards:view`) may enter; technicians and partner users get the 403 of the shell (a partner user
 * has their own ROI dashboard at `/partner/roi`).
 */
export default async function RoiLayout({ children }: RoiLayoutProps) {
  await requirePermission("dashboards:view");

  return <>{children}</>;
}
