import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";

interface PartnersLayoutProps {
  children: ReactNode;
}

export default async function PartnersLayout({ children }: PartnersLayoutProps) {
  const user = await requirePermission("partners:manage");

  return <AppShell user={user}>{children}</AppShell>;
}
