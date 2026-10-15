import { describe, expect, it } from "vitest";

import {
  getNavItemPermissions,
  getVisibleNavItems,
  NAV_ITEMS,
} from "@/config/nav";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";

describe("getVisibleNavItems", () => {
  it("should match hasAnyPermission() for every nav item, for every role", () => {
    for (const role of ROLES) {
      const visible = getVisibleNavItems(role);
      const visibleHrefs = visible.map((item) => item.href);

      for (const item of NAV_ITEMS) {
        const expected = hasAnyPermission(role, getNavItemPermissions(item));
        expect(visibleHrefs.includes(item.href)).toBe(expected);
      }
    }
  });

  it("should show all 10 area links to admin (full system access)", () => {
    const visible = getVisibleNavItems("admin");

    expect(visible.map((item) => item.href).sort()).toEqual(
      [
        "/admin",
        "/airports",
        "/bookings",
        "/jobs",
        "/partner",
        "/partners",
        "/seat-categories",
        "/seats",
        "/technician",
        "/technicians",
      ].sort(),
    );
  });

  it("should show the admin, partners, airports, seat categories, seats, technicians, jobs, and bookings links to operations_manager", () => {
    const visible = getVisibleNavItems("operations_manager");

    expect(visible.map((item) => item.href).sort()).toEqual(
      [
        "/admin",
        "/airports",
        "/bookings",
        "/jobs",
        "/partners",
        "/seat-categories",
        "/seats",
        "/technicians",
      ].sort(),
    );
  });

  it("should show the jobs and technician links to technician", () => {
    const visible = getVisibleNavItems("technician");

    expect(visible.map((item) => item.href).sort()).toEqual(
      ["/jobs", "/technician"].sort(),
    );
  });

  it("should show the partner portal and bookings links to partner_user", () => {
    const visible = getVisibleNavItems("partner_user");

    expect(visible.map((item) => item.href).sort()).toEqual(
      ["/bookings", "/partner"].sort(),
    );
  });

  it("should not show the bookings link to technician", () => {
    const visible = getVisibleNavItems("technician");

    expect(visible.map((item) => item.href)).not.toContain("/bookings");
  });
});

describe("NAV_ITEMS", () => {
  it("should have a defined icon for every nav item", () => {
    for (const item of NAV_ITEMS) {
      expect(item.icon).toBeDefined();
    }
  });
});
