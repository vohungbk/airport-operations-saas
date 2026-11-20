import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Technicians" };

interface TechniciansLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the layout of `(admin)` already provides `AppShell`. A user without the
 * permission gets a 403 inside that shell (`forbidden()`).
 */
export default async function TechniciansLayout({ children }: TechniciansLayoutProps) {
  await requirePermission("technicians:manage");

  return <>{children}</>;
}
