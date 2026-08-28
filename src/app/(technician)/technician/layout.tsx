import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";

interface TechnicianLayoutProps {
  children: ReactNode;
}

export default async function TechnicianLayout({
  children,
}: TechnicianLayoutProps) {
  const user = await requirePermission("jobs:view_assigned");

  return <AppShell user={user}>{children}</AppShell>;
}
