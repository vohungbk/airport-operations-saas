import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";

interface PartnerLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the layout of `(partner)` already provides `AppShell`. A user without the
 * permission gets a 403 inside that shell (`forbidden()`).
 */
export default async function PartnerLayout({ children }: PartnerLayoutProps) {
  await requirePermission("bookings:view_own_partner");

  return <>{children}</>;
}
