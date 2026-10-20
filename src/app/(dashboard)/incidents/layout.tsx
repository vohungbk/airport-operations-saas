import type { ReactNode } from "react";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { INCIDENTS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

interface IncidentsLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the `(dashboard)` layout already provides `AppShell`. Managers,
 * partner users and technicians may enter the area; which incidents each one
 * gets is decided by RLS. Reporting and changing a status add their own
 * stricter guards on the page and in the Server Action.
 */
export default async function IncidentsLayout({
  children,
}: IncidentsLayoutProps) {
  await requireAnyPermission(INCIDENTS_ACCESS_PERMISSIONS);

  return <>{children}</>;
}
