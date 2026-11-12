import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";

interface ReturnQueueLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the `(dashboard)` layout already provides `AppShell`. Admin and
 * operations manager (`dashboards:view`) watch the queue; which bookings they
 * get is decided by RLS.
 */
export default async function ReturnQueueLayout({
  children,
}: ReturnQueueLayoutProps) {
  await requirePermission("dashboards:view");

  return <>{children}</>;
}
