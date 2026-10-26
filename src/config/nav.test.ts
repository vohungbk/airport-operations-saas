import { describe, expect, it } from "vitest";

import { Circle } from "lucide-react";

import {
  getNavIcon,
  getNavItemPermissions,
  getVisibleNavItems,
  NAV_ITEMS,
  ROLE_MENUS,
} from "@/config/nav";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";

describe("getVisibleNavItems", () => {
  it("should match hasAnyPermission() for every nav item, for every role that has the full menu", () => {
    for (const role of ROLES.filter((r) => !ROLE_MENUS[r])) {
      const visible = getVisibleNavItems(role);
      const visibleHrefs = visible.map((item) => item.href);

      for (const item of NAV_ITEMS) {
        const expected = hasAnyPermission(role, getNavItemPermissions(item));
        expect(visibleHrefs.includes(item.href)).toBe(expected);
      }
    }
  });

  it("should show all 13 area links to admin (full system access)", () => {
    const visible = getVisibleNavItems("admin");

    expect(visible.map((item) => item.href).sort()).toEqual(
      [
        "/admin",
        "/airports",
        "/bookings",
        "/dashboard",
        "/incidents",
        "/jobs",
        "/partner",
        "/partners",
        "/seat-categories",
        "/seats",
        "/settlements",
        "/technician",
        "/technicians",
      ].sort(),
    );
  });

  it("should show the admin, partners, airports, seat categories, seats, technicians, jobs, bookings, incidents, and settlements links to operations_manager", () => {
    const visible = getVisibleNavItems("operations_manager");

    expect(visible.map((item) => item.href).sort()).toEqual(
      [
        "/admin",
        "/airports",
        "/bookings",
        "/dashboard",
        "/incidents",
        "/jobs",
        "/partners",
        "/seat-categories",
        "/seats",
        "/settlements",
        "/technicians",
      ].sort(),
    );
  });

  it("should give the technician Today's Jobs and Incidents, and nothing else (spec R8)", () => {
    const visible = getVisibleNavItems("technician");

    expect(visible.map((item) => [item.label, item.href])).toEqual([
      ["Today's Jobs", "/technician"],
      ["Incidents", "/incidents"],
    ]);
  });

  it("should give the partner user Overview, Rentals, Seats and Finance, in that order (spec R8)", () => {
    const visible = getVisibleNavItems("partner_user");

    expect(visible.map((item) => [item.label, item.href])).toEqual([
      ["Overview", "/partner"],
      ["Rentals", "/bookings"],
      ["Seats", "/partner/seats"],
      ["Finance", "/settlements"],
    ]);
  });

  it("should leave out the pages that do not exist yet: My History, KPI, ROI and Assistant", () => {
    const labels = [...ROLES.flatMap((role) => getVisibleNavItems(role))].map((item) => item.label);

    for (const missing of ["My History", "KPI", "ROI", "Assistant"]) {
      expect(labels).not.toContain(missing);
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
});
