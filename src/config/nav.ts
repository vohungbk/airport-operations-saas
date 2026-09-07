import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  Plane,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

import { hasPermission, type Permission } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";

export interface NavItem {
  label: string;
  href: string;
  permission: Permission;
  icon: LucideIcon;
}

/**
 * The 3 protected area links. Gated by the same business permissions the
 * area's `layout.tsx`/`page.tsx` guard with (`requirePermission`) — no
 * separate `*:access` permission is introduced just for nav/route
 * visibility.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Admin Operations",
    href: "/admin",
    permission: "dashboards:view",
    icon: LayoutDashboard,
  },
  {
    label: "Partners",
    href: "/partners",
    permission: "partners:manage",
    icon: Building2,
  },
  {
    label: "Airports",
    href: "/airports",
    permission: "airports:manage",
    icon: Plane,
  },
  {
    label: "Technician Jobs",
    href: "/technician",
    permission: "jobs:view_assigned",
    icon: ClipboardList,
  },
  {
    label: "Partner Portal",
    href: "/partner",
    permission: "bookings:view_own_partner",
    icon: UserCircle,
  },
];

/**
 * Pure — the single source of truth for which nav links a role sees.
 * Server Components compute this and pass the filtered list down; client
 * components never re-derive it.
 */
export function getVisibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => hasPermission(role, item.permission));
}
