import type { ReactNode } from "react";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { JOBS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

interface JobsLayoutProps {
  children: ReactNode;
}

/**
 * Guard only — the `(dashboard)` layout already provides `AppShell`.
 * Admin/ops (`technicians:manage`) and technicians (`jobs:view_assigned`)
 * may enter; partner users are forbidden.
 */
export default async function JobsLayout({ children }: JobsLayoutProps) {
  await requireAnyPermission(JOBS_ACCESS_PERMISSIONS);

  return <>{children}</>;
}
