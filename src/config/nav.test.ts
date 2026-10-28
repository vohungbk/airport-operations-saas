import { describe, expect, it } from "vitest";

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
  Plane,
  RefreshCw,
  Settings,
  Tag,
  TrendingUp,
  TriangleAlert,
  Upload,
  User,
  UserCircle,
  Users,
} from "lucide-react";

import {
  getNavIcon,
  getNavItemPermissions,
  getVisibleNavItems,
  NAV_ITEMS,
  ROLE_MENUS,
} from "@/config/nav";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";

/** The text and the icon of each item of the Figma sidebar of admin, in order (UI-F02-T01). */
const FIGMA_ADMIN_MENU = [
  ["Command Centre", LayoutDashboard],
  ["Bookings", Plane],
  ["Workflow Board", LayoutGrid],
  ["Seats", Users],
  ["Seat Categories", Tag],
  ["Airports", MapPin],
  ["Partners", Briefcase],
  ["Technicians", User],
  ["Jobs", ClipboardList],
  ["Return Queue", RefreshCw],
  ["Incidents", TriangleAlert],
  ["Flights", Plane],
  ["Finance", CreditCard],
  ["Reports", BarChart3],
  ["Import", Upload],
  ["Settings", Settings],
] as const;

const labelsAndIcons = (role: Parameters<typeof getVisibleNavItems>[0]) =>
  getVisibleNavItems(role).map((item) => [item.label, item.icon]);

describe("getVisibleNavItems", () => {
  it("should match hasAnyPermission() for every nav item, for every role that has the full menu", () => {
    for (const role of ROLES.filter((r) => !ROLE_MENUS[r])) {
      const visibleHrefs = getVisibleNavItems(role).map((item) => item.href);

      for (const item of NAV_ITEMS) {
        const expected = hasAnyPermission(role, getNavItemPermissions(item));
        expect(visibleHrefs.includes(item.href)).toBe(expected);
      }
    }
  });

  it("should give admin the whole menu, flat, with the text, icons and order of the Figma sidebar", () => {
    expect(labelsAndIcons("admin")).toEqual(FIGMA_ADMIN_MENU.map((entry) => [...entry]));
  });

  it("should give the operations manager the same full menu as admin", () => {
    expect(getVisibleNavItems("operations_manager").map((item) => item.href)).toEqual(
      getVisibleNavItems("admin").map((item) => item.href),
    );
  });

  it("should give the technician Today's Jobs, My History and Incidents, and nothing else", () => {
    expect(getVisibleNavItems("technician").map((item) => [item.label, item.href])).toEqual([
      ["Today's Jobs", "/technician"],
      ["My History", "/technician/history"],
      ["Incidents", "/incidents"],
    ]);
  });

  it("should give the partner user Overview, Rentals, Seats, Finance, KPI, ROI and Assistant, in that order", () => {
    expect(getVisibleNavItems("partner_user").map((item) => [item.label, item.href])).toEqual([
      ["Overview", "/partner"],
      ["Rentals", "/bookings"],
      ["Seats", "/partner/seats"],
      ["Finance", "/settlements"],
      ["KPI", "/partner/kpi"],
      ["ROI", "/partner/roi"],
      ["Assistant", "/partner/assistant"],
    ]);
  });

  it("should use the icons the design gives to the technician and partner items that have one", () => {
    expect(labelsAndIcons("technician")).toEqual([
      ["Today's Jobs", ClipboardList],
      ["My History", History],
      ["Incidents", TriangleAlert],
    ]);
    expect(labelsAndIcons("partner_user")).toEqual([
      ["Overview", UserCircle],
      ["Rentals", Plane],
      ["Seats", Users],
      ["Finance", CreditCard],
      ["KPI", BarChart3],
      ["ROI", TrendingUp],
      ["Assistant", MessageSquare],
    ]);
  });

  it("should leave the admin-only pages out of the technician and partner menus", () => {
    const internal = ["/admin", "/partners", "/airports", "/seat-categories", "/seats", "/technicians", "/jobs"];

    for (const role of ["technician", "partner_user"] as const) {
      const hrefs = getVisibleNavItems(role).map((item) => item.href);
      for (const href of internal) expect(hrefs, `${role}: ${href}`).not.toContain(href);
    }
  });

  it("should not show the technician and partner pages in the menu of admin and operations manager", () => {
    for (const role of ["admin", "operations_manager"] as const) {
      const labels = getVisibleNavItems(role).map((item) => item.label);
      expect(labels).not.toContain("Technician Jobs");
      expect(labels).not.toContain("Partner Portal");
    }
  });

  it("should not show the bookings link to technician", () => {
    expect(getVisibleNavItems("technician").map((item) => item.href)).not.toContain("/bookings");
  });

  it("should list only items that the role holds a permission for, for every role", () => {
    for (const role of ROLES) {
      for (const item of getVisibleNavItems(role)) {
        expect(hasAnyPermission(role, getNavItemPermissions(item)), `${role}: ${item.href}`).toBe(true);
      }
    }
  });

  it("should not repeat an address inside one menu", () => {
    for (const role of ROLES) {
      const hrefs = getVisibleNavItems(role).map((item) => item.href);
      expect(new Set(hrefs).size, role).toBe(hrefs.length);
    }
  });
});

describe("ROLE_MENUS", () => {
  it("should only have menus for roles of the database", () => {
    for (const role of Object.keys(ROLE_MENUS)) {
      expect(ROLES).toContain(role);
    }
  });

  it("should not touch the full menu of admin and operations manager", () => {
    expect(ROLE_MENUS.admin).toBeUndefined();
    expect(ROLE_MENUS.operations_manager).toBeUndefined();
  });
});

describe("getNavIcon", () => {
  it("should give a real icon to every item of every menu a role can see", () => {
    for (const role of ROLES) {
      for (const item of getVisibleNavItems(role)) {
        expect(getNavIcon(item.href), `${role}: ${item.href}`).toBe(item.icon);
        expect(item.icon).not.toBe(Circle);
      }
    }
  });

  it("should give a plain circle for an address that is in no menu", () => {
    expect(getNavIcon("/not-a-page")).toBe(Circle);
  });
});

describe("NAV_ITEMS", () => {
  it("should have a defined icon for every nav item", () => {
    for (const item of NAV_ITEMS) {
      expect(item.icon).toBeDefined();
    }
  });

  it("should mark the items whose page is not built yet, so they are easy to find", () => {
    expect(NAV_ITEMS.filter((item) => item.planned).map((item) => item.label)).toEqual([
      "Return Queue",
      "Flights",
      "Reports",
      "Import",
      "Settings",
    ]);
  });
});
