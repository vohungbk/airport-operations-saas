import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/lib/auth/permissions";
import { ROLES, type Role } from "@/lib/auth/roles";

const current = vi.hoisted(() => ({ role: "admin" as string }));

// The guards, with the real permission rules: they throw like `redirect()`
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
        throw new Error("REDIRECT:/forbidden");
      }
      return user();
    },
    requireAnyPermission: async (list: readonly Permission[]) => {
      if (!permissions.hasAnyPermission(current.role as Role, list)) {
        throw new Error("REDIRECT:/forbidden");
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

import { NAV_ITEMS, getVisibleNavItems } from "@/config/nav";

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
  "/technician": () => import("@/app/(technician)/technician/layout"),
  "/partner": () => import("@/app/(partner)/partner/layout"),
};

async function opens(href: string, role: Role): Promise<boolean> {
  current.role = role;
  const entry = (await GUARDS[href]()).default as (props: {
    children: null;
  }) => Promise<unknown>;

  try {
    await entry({ children: null });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === "REDIRECT:/forbidden") {
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
    "should open the module of every link %s sees, and refuse the ones it does not see",
    async (role) => {
      const visible = new Set(getVisibleNavItems(role).map((item) => item.href));

      for (const item of NAV_ITEMS) {
        expect(await opens(item.href, role), `${role}: ${item.href}`).toBe(
          visible.has(item.href),
        );
      }
    },
  );
});
