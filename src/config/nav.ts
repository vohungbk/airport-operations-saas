import {
  Armchair,
  Boxes,
  CalendarCheck,
  Gauge,
  Building2,
  ClipboardList,
  Landmark,
  ListChecks,
  LayoutDashboard,
  Plane,
  Circle,
  TriangleAlert,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  BOOKINGS_ACCESS_PERMISSIONS,
  DASHBOARD_ACCESS_PERMISSIONS,
  FINANCE_ACCESS_PERMISSIONS,
  INCIDENTS_ACCESS_PERMISSIONS,
  JOBS_ACCESS_PERMISSIONS,
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
    label: "Dashboard",
    href: "/dashboard",
    permission: DASHBOARD_ACCESS_PERMISSIONS,
    icon: Gauge,
  },
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
    label: "Technicians",
    href: "/technicians",
    permission: "technicians:manage",
    icon: Users,
  },
  {
    label: "Bookings",
    href: "/bookings",
    permission: BOOKINGS_ACCESS_PERMISSIONS,
    icon: CalendarCheck,
  },
  {
    label: "Jobs",
    href: "/jobs",
    permission: JOBS_ACCESS_PERMISSIONS,
    icon: ListChecks,
  },
  {
    label: "Incidents",
    href: "/incidents",
    permission: INCIDENTS_ACCESS_PERMISSIONS,
    icon: TriangleAlert,
  },
  {
    label: "Settlements",
    href: "/settlements",
    permission: FINANCE_ACCESS_PERMISSIONS,
    icon: Landmark,
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
 * UI-F02-S04 (spec R8): the technician and the partner user have a shorter menu of their own,
 * with names that fit their work. Admin and operations manager have the full menu above. A menu
 * is only a look: the page behind an item is guarded on the server (spec R9), and a role can still
 * open a page it holds the permission for even when the page is not in its menu.
 *
 * Pages of the spec that do not exist yet (My History, KPI, ROI, Assistant) are not listed.
 */
export const ROLE_MENUS: Partial<Record<Role, NavItem[]>> = {
  technician: [
    {
      label: "Today's Jobs",
      href: "/technician",
      permission: "jobs:view_assigned",
      icon: ClipboardList,
    },
    {
      label: "Incidents",
      href: "/incidents",
      permission: INCIDENTS_ACCESS_PERMISSIONS,
      icon: TriangleAlert,
    },
  ],
  partner_user: [
    {
      label: "Overview",
      href: "/partner",
      permission: "bookings:view_own_partner",
      icon: UserCircle,
    },
    {
      label: "Rentals",
      href: "/bookings",
      permission: BOOKINGS_ACCESS_PERMISSIONS,
      icon: CalendarCheck,
    },
    {
      label: "Seats",
      href: "/partner/seats",
      permission: "bookings:view_own_partner",
      icon: Boxes,
    },
    {
      label: "Finance",
      href: "/settlements",
      permission: FINANCE_ACCESS_PERMISSIONS,
      icon: Landmark,
    },
  ],
};

/** The menu a role starts from: its own, or the full one. */
function menuOf(role: Role): NavItem[] {
  return ROLE_MENUS[role] ?? NAV_ITEMS;
}

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
  return menuOf(role).filter((item) =>
    hasAnyPermission(role, getNavItemPermissions(item)),
  );
}

const ICONS_BY_HREF = new Map(
  [...NAV_ITEMS, ...Object.values(ROLE_MENUS).flat()].map((item) => [item.href, item.icon]),
);

/**
 * The icon of a menu item, found by its address in the full menu or in a role menu. A Lucide
 * icon cannot cross from a Server Component to a Client Component as data, so the menu is passed
 * as text and the client looks the icon up here.
 */
export function getNavIcon(href: string): LucideIcon {
  return ICONS_BY_HREF.get(href) ?? Circle;
}
