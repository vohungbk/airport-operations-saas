import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";

interface TechniciansLayoutProps {
  children: ReactNode;
}

export default async function TechniciansLayout({
  children,
}: TechniciansLayoutProps) {
  const user = await requirePermission("technicians:manage");

  return <AppShell user={user}>{children}</AppShell>;
}
