import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";

interface AirportsLayoutProps {
  children: ReactNode;
}

export default async function AirportsLayout({ children }: AirportsLayoutProps) {
  const user = await requirePermission("airports:manage");

  return <AppShell user={user}>{children}</AppShell>;
}
