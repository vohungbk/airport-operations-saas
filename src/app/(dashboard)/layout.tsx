import type { ReactNode } from "react";

import { requireAuth } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const user = await requireAuth();

  return <AppShell user={user}>{children}</AppShell>;
}
