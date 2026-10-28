import {
  BarChart3,
  Briefcase,
  ClipboardList,
  Circle,
  CreditCard,
  History,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  MessageSquare,
  RefreshCw,
  Plane,
  Settings,
  Tag,
  TrendingUp,
  TriangleAlert,
  Upload,
  User,
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
  /**
   * The page behind this item is built in its own feature and does not exist yet, so the link
   * answers 404 until then. The item is in the menu because the design has it (UI-F02-T01).
   */
  planned?: true;
}

/**
 * UI-F02-T01: the menu of admin and operations manager, with the text, the icons and the order of
 * the Figma sidebar. It is one flat list, as in the design. It is gated by the same business
 * permissions the area's `layout.tsx`/`page.tsx` guard with (`requirePermission`); no separate
 * `*:access` permission is introduced just for nav/route visibility. The technician and the
 * partner user have a menu of their own (`ROLE_MENUS`), so their pages are not listed here.
 *
 * Items marked `planned` have no page yet: they use `dashboards:view` (managers only) until the
 * feature that builds the page gives them their own permission.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Command Centre",
    href: "/dashboard",
    permission: DASHBOARD_ACCESS_PERMISSIONS,
    icon: LayoutDashboard,
  },
  {
    label: "Bookings",
    href: "/bookings",
    permission: BOOKINGS_ACCESS_PERMISSIONS,
    icon: Plane,
  },
  {
    label: "Workflow Board",
    href: "/admin",
    permission: "dashboards:view",
    icon: LayoutGrid,
  },
  { label: "Seats", href: "/seats", permission: "seats:manage", icon: Users },
  {
    label: "Seat Categories",
    href: "/seat-categories",
    permission: "seat_categories:manage",
    icon: Tag,
  },
  { label: "Airports", href: "/airports", permission: "airports:manage", icon: MapPin },
  { label: "Partners", href: "/partners", permission: "partners:manage", icon: Briefcase },
  { label: "Technicians", href: "/technicians", permission: "technicians:manage", icon: User },
  { label: "Jobs", href: "/jobs", permission: JOBS_ACCESS_PERMISSIONS, icon: ClipboardList },
  {
    label: "Return Queue",
    href: "/return-queue",
    permission: "dashboards:view",
    icon: RefreshCw,
    planned: true,
  },
  {
    label: "Incidents",
    href: "/incidents",
    permission: INCIDENTS_ACCESS_PERMISSIONS,
    icon: TriangleAlert,
  },
  {
    label: "Flights",
    href: "/flights",
    permission: "dashboards:view",
    icon: Plane,
    planned: true,
  },
  {
    label: "Finance",
    href: "/settlements",
    permission: FINANCE_ACCESS_PERMISSIONS,
    icon: CreditCard,
  },
  {
    label: "Reports",
    href: "/reports",
    permission: "dashboards:view",
    icon: BarChart3,
    planned: true,
  },
  {
    label: "Import",
    href: "/import",
    permission: "dashboards:view",
    icon: Upload,
    planned: true,
  },
  {
    label: "Settings",
    href: "/settings",
    permission: "dashboards:view",
    icon: Settings,
    planned: true,
  },
];

/**
 * UI-F02-S04 (spec R8) and UI-F02-T01: the technician and the partner user have a shorter menu of
 * their own, with names that fit their work. Admin and operations manager have the full menu
 * above. A menu is only a look: the page behind an item is guarded on the server (spec R9), and a
 * role can still open a page it holds the permission for even when the page is not in its menu.
 *
 * My History, KPI, ROI and Assistant have no page yet. The layout of their area already guards
 * them, so another role gets a 403 and the right role gets a 404 until the page exists.
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
      label: "My History",
      href: "/technician/history",
      permission: "jobs:view_assigned",
      icon: History,
      planned: true,
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
      icon: Plane,
    },
    {
      label: "Seats",
      href: "/partner/seats",
      permission: "bookings:view_own_partner",
      icon: Users,
    },
    {
      label: "Finance",
      href: "/settlements",
      permission: FINANCE_ACCESS_PERMISSIONS,
      icon: CreditCard,
    },
    {
      label: "KPI",
      href: "/partner/kpi",
      permission: "bookings:view_own_partner",
      icon: BarChart3,
      planned: true,
    },
    {
      label: "ROI",
      href: "/partner/roi",
      permission: "bookings:view_own_partner",
      icon: TrendingUp,
      planned: true,
    },
    {
      label: "Assistant",
      href: "/partner/assistant",
      permission: "bookings:view_own_partner",
      icon: MessageSquare,
      planned: true,
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
