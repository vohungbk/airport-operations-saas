import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/lib/auth/permissions";
import { ROLES, type Role } from "@/lib/auth/roles";

const current = vi.hoisted(() => ({ role: "admin" as string }));

// The guards, with the real permission rules: they throw like `forbidden()`
// does when the role does not hold the permission.
vi.mock("@/lib/auth/current-user", async () => {
  const permissions = await import("@/lib/auth/permissions");
  const user = () => ({
    id: "u-1",
    email: "u@example.com",
    full_name: "U",
    role: current.role as Role,
    partner_id: "p-1",
    is_active: true,
  });

  return {
    requireAuth: async () => user(),
    requirePermission: async (permission: Permission) => {
      if (!permissions.hasPermission(current.role as Role, permission)) {
        throw new Error("FORBIDDEN");
      }
      return user();
    },
    requireAnyPermission: async (list: readonly Permission[]) => {
      if (!permissions.hasAnyPermission(current.role as Role, list)) {
        throw new Error("FORBIDDEN");
      }
      return user();
    },
  };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/components/layout/app-shell", () => ({ AppShell: () => null }));
vi.mock("@/features/dashboard/lib/get-dashboard-metrics", () => ({
  getDashboardMetrics: async () => [],
}));
vi.mock("@/features/dashboard/lib/get-dashboard-charts", () => ({
  getDashboardCharts: async () => [],
}));

vi.mock("@/features/settlements/lib/get-settlements", () => ({
  getSettlements: async () => [],
}));
vi.mock("@/features/settlements/lib/get-settlement-partners", () => ({
  getSettlementPartners: async () => [],
}));
vi.mock("@/features/settlements/components/generate-settlement-form", () => ({
  GenerateSettlementForm: () => null,
}));

import {
  NAV_ITEMS,
  ROLE_MENUS,
  getNavItemPermissions,
  getVisibleNavItems,
} from "@/config/nav";
import { hasAnyPermission } from "@/lib/auth/permissions";

/** The entry (layout, or page where there is no layout) that guards each nav link. */
const GUARDS: Record<string, () => Promise<{ default: unknown }>> = {
  "/dashboard": () => import("@/app/(dashboard)/dashboard/page"),
  "/admin": () => import("@/app/(admin)/admin/layout"),
  "/partners": () => import("@/app/(admin)/partners/layout"),
  "/airports": () => import("@/app/(admin)/airports/layout"),
  "/seat-categories": () => import("@/app/(admin)/seat-categories/layout"),
  "/seats": () => import("@/app/(admin)/seats/layout"),
  "/technicians": () => import("@/app/(admin)/technicians/layout"),
  "/bookings": () => import("@/app/(dashboard)/bookings/layout"),
  "/jobs": () => import("@/app/(dashboard)/jobs/layout"),
  "/incidents": () => import("@/app/(dashboard)/incidents/layout"),
  "/settlements": () => import("@/app/(dashboard)/settlements/page"),
};

/**
 * Pages of a role menu that are not a link of the full menu. The layout of the technician area
 * and the layout of the partner portal guard the pages below them, so `/partner/seats` and the
 * pages not built yet (My History, KPI, ROI, Assistant) are guarded by them: another role gets a
 * 403 now, and the right role gets a 404 until the page exists.
 */
const EXTRA_GUARDS: Record<string, () => Promise<{ default: unknown }>> = {
  "/technician": () => import("@/app/(technician)/technician/layout"),
  "/technician/history": () => import("@/app/(technician)/technician/layout"),
  "/technician/scan": () => import("@/app/(technician)/technician/layout"),
  "/partner": () => import("@/app/(partner)/partner/layout"),
  "/partner/seats": () => import("@/app/(partner)/partner/layout"),
  "/partner/finance": () => import("@/app/(partner)/partner/layout"),
  "/partner/kpi": () => import("@/app/(partner)/partner/layout"),
  "/partner/roi": () => import("@/app/(partner)/partner/layout"),
  "/partner/assistant": () => import("@/app/(partner)/partner/layout"),
};

const guardOf = (href: string) => GUARDS[href] ?? EXTRA_GUARDS[href];

/** Every item of every menu, by address. */
const ALL_ITEMS = new Map(
  [...NAV_ITEMS, ...Object.values(ROLE_MENUS).flat()].map(
    (item) => [item.href, item],
  ),
);

async function opens(href: string, role: Role): Promise<boolean> {
  current.role = role;
  const entry = (await guardOf(href)()).default as (props: {
    children: null;
  }) => Promise<unknown>;

  try {
    await entry({ children: null });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return false;
    }
    // The dashboard sends a partner user to their home: the link still opens
    // a module for them, it is just not the dashboard.
    if (error instanceof Error && error.message === "REDIRECT:/partner") {
      return true;
    }
    throw error;
  }
}

describe("navigation and the module it opens (VI-F01-S04, Nav-2)", () => {
  beforeEach(() => {
    current.role = "admin";
  });

  it("should have a guarded destination for every item of the full menu whose page exists", () => {
    expect(Object.keys(GUARDS).sort()).toEqual(
      NAV_ITEMS.filter((item) => !item.planned)
        .map((item) => item.href)
        .sort(),
    );
  });

  it("should guard every item of a role menu, by its own page or by the layout of its area", () => {
    for (const menu of Object.values(ROLE_MENUS)) {
      for (const { href } of menu) {
        expect(guardOf(href), href).toBeDefined();
      }
    }
  });

  it.each(ROLES)(
    "should open the module of every link that %s holds the permission for, and answer forbidden for the others",
    async (role) => {
      for (const [href, item] of ALL_ITEMS) {
        if (!guardOf(href)) continue;
        const allowed = hasAnyPermission(role, getNavItemPermissions(item));

        expect(await opens(href, role), `${role}: ${href}`).toBe(allowed);
      }
    },
  );

  it.each(["technician", "partner_user"] as const)(
    "should answer forbidden to %s for the address of an admin-only page that is not in its menu",
    async (role) => {
      const adminOnly = ["/admin", "/partners", "/airports", "/seat-categories", "/seats", "/technicians"];

      for (const href of adminOnly) {
        expect(await opens(href, role), `${role}: ${href}`).toBe(false);
      }
    },
  );

  it.each(ROLES)(
    "should never show %s a link that its guard refuses",
    async (role) => {
      for (const item of getVisibleNavItems(role)) {
        if (!guardOf(item.href)) continue;

        expect(await opens(item.href, role), `${role}: ${item.href}`).toBe(true);
      }
    },
  );
});
