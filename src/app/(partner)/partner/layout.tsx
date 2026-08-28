import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";

interface PartnerLayoutProps {
  children: ReactNode;
}

export default async function PartnerLayout({
  children,
}: PartnerLayoutProps) {
  const user = await requirePermission("bookings:view_own_partner");

  return <AppShell user={user}>{children}</AppShell>;
}
