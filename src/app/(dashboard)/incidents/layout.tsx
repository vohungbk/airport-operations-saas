import type { ReactNode } from "react";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { INCIDENTS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

interface IncidentsLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the `(dashboard)` layout already provides `AppShell`. Admin
 * and operations manager (`incidents:view`) may enter; technicians and
 * partner users are forbidden here (their scope is a later story).
 */
export default async function IncidentsLayout({
  children,
}: IncidentsLayoutProps) {
  await requireAnyPermission(INCIDENTS_ACCESS_PERMISSIONS);

  return <>{children}</>;
}
