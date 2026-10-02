import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";

interface SeatsLayoutProps {
  children: ReactNode;
}

export default async function SeatsLayout({ children }: SeatsLayoutProps) {
  const user = await requirePermission("seats:manage");

  return <AppShell user={user}>{children}</AppShell>;
}
