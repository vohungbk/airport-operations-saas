import type { ReactNode } from "react";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { INCIDENT_REPORT_PERMISSIONS } from "@/lib/auth/permissions";

interface IncidentsLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the `(dashboard)` layout already provides `AppShell`. Admin and
 * operations manager (`incidents:view`) and technicians (`incidents:report`)
 * may enter the area; partner users are forbidden. The list and the detail add
 * their own `incidents:view` guard, so a technician reaches only the report
 * form (their view scope is a later story).
 */
export default async function IncidentsLayout({
  children,
}: IncidentsLayoutProps) {
  await requireAnyPermission(INCIDENT_REPORT_PERMISSIONS);

  return <>{children}</>;
}
