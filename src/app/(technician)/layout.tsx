import type { ReactNode } from "react";

import { requireAuth } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";

interface TechnicianLayoutProps {
  children: ReactNode;
}

/**
 * The shell of every page of the technician area. It only needs a signed-in user with a valid profile;
 * the layout of each area below checks the permission of that area and, when it is missing,
 * calls `forbidden()`, which renders `forbidden.tsx` inside this shell (UI-F02-S04).
 */
export default async function TechnicianLayout({
  children,
}: TechnicianLayoutProps) {
  const user = await requireAuth();

  return <AppShell user={user}>{children}</AppShell>;
}
