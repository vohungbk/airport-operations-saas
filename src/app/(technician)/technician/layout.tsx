import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Technician" };

interface TechnicianLayoutProps {
  children: ReactNode;
}

/**
 * Guard only: the layout of `(technician)` already provides `AppShell`. A user without the
 * permission gets a 403 inside that shell (`forbidden()`).
 */
export default async function TechnicianLayout({ children }: TechnicianLayoutProps) {
  await requirePermission("jobs:view_assigned");

  return <>{children}</>;
}
