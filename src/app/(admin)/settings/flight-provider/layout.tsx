import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/current-user";

interface FlightProviderLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the layout of `(admin)` already provides `AppShell`. Only an admin manages the
 * flight provider settings (spec 2.1); any other role gets a 403 inside that shell.
 */
export default async function FlightProviderLayout({ children }: FlightProviderLayoutProps) {
  await requireRole(["admin"]);

  return <>{children}</>;
}
