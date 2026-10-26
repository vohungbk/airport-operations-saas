import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";

interface SeatCategoriesLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the layout of `(admin)` already provides `AppShell`. A user without the
 * permission gets a 403 inside that shell (`forbidden()`).
 */
export default async function SeatCategoriesLayout({ children }: SeatCategoriesLayoutProps) {
  await requirePermission("seat_categories:manage");

  return <>{children}</>;
}
