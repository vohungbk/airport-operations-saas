import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";

interface SeatCategoriesLayoutProps {
  children: ReactNode;
}

export default async function SeatCategoriesLayout({
  children,
}: SeatCategoriesLayoutProps) {
  const user = await requirePermission("seat_categories:manage");

  return <AppShell user={user}>{children}</AppShell>;
}
