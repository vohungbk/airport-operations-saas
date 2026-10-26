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

import { NAV_ITEMS, getNavItemPermissions, getVisibleNavItems } from "@/config/nav";
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
  "/technician": () => import("@/app/(technician)/technician/layout"),
  "/partner": () => import("@/app/(partner)/partner/layout"),
};

/**
 * Pages of a role menu that are not a link of the full menu. The layout of the partner portal
 * guards the pages below it, so `/partner/seats` is guarded by it.
 */
const EXTRA_GUARDS: Record<string, () => Promise<{ default: unknown }>> = {
  "/partner/seats": () => import("@/app/(partner)/partner/layout"),
};

async function opens(href: string, role: Role): Promise<boolean> {
  current.role = role;
  const entry = (await (GUARDS[href] ?? EXTRA_GUARDS[href])()).default as (props: {
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

  it("should have a guarded destination for every nav item", () => {
    expect(Object.keys(GUARDS).sort()).toEqual(
      NAV_ITEMS.map((item) => item.href).sort(),
    );
  });

  it.each(ROLES)(
    "should open the module of every link of the full menu that %s holds the permission for, and refuse the others",
    async (role) => {
      for (const item of NAV_ITEMS) {
        const allowed = hasAnyPermission(role, getNavItemPermissions(item));

        expect(await opens(item.href, role), `${role}: ${item.href}`).toBe(allowed);
      }
    },
  );

  it.each(ROLES)(
    "should never show %s a link that its guard refuses",
    async (role) => {
      for (const item of getVisibleNavItems(role)) {
        expect(await opens(item.href, role), `${role}: ${item.href}`).toBe(true);
      }
    },
  );
});
