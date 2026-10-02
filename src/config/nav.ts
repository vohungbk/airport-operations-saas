import {
  Armchair,
  Boxes,
  CalendarCheck,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Plane,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

import {
  BOOKINGS_ACCESS_PERMISSIONS,
  hasAnyPermission,
  type Permission,
} from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";

export interface NavItem {
  label: string;
  href: string;
  /** A single permission, or a list where holding any one is enough. */
  permission: Permission | readonly Permission[];
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
    label: "Seat Categories",
    href: "/seat-categories",
    permission: "seat_categories:manage",
    icon: Armchair,
  },
  {
    label: "Seats",
    href: "/seats",
    permission: "seats:manage",
    icon: Boxes,
  },
  {
    label: "Bookings",
    href: "/bookings",
    permission: BOOKINGS_ACCESS_PERMISSIONS,
    icon: CalendarCheck,
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
export function getNavItemPermissions(item: NavItem): readonly Permission[] {
  return typeof item.permission === "string"
    ? [item.permission]
    : item.permission;
}

export function getVisibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) =>
    hasAnyPermission(role, getNavItemPermissions(item)),
  );
}
