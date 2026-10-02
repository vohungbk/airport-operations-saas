import type { ReactNode } from "react";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { BOOKINGS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

interface BookingsLayoutProps {
  children: ReactNode;
}

/**
 * Guard only — the `(dashboard)` layout already provides `AppShell`.
 * Admin/ops (`bookings:manage`) and partner users
 * (`bookings:view_own_partner`) may enter; technicians are forbidden.
 */
export default async function BookingsLayout({
  children,
}: BookingsLayoutProps) {
  await requireAnyPermission(BOOKINGS_ACCESS_PERMISSIONS);

  return <>{children}</>;
}
