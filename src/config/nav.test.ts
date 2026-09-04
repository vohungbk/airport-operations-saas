import { describe, expect, it } from "vitest";

import { getVisibleNavItems, NAV_ITEMS } from "@/config/nav";
import { hasPermission } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";

describe("getVisibleNavItems", () => {
  it("should match hasPermission() for every nav item, for every role", () => {
    for (const role of ROLES) {
      const visible = getVisibleNavItems(role);
      const visibleHrefs = visible.map((item) => item.href);

      for (const item of NAV_ITEMS) {
        const expected = hasPermission(role, item.permission);
        expect(visibleHrefs.includes(item.href)).toBe(expected);
      }
    }
  });

  it("should show all 4 area links to admin (full system access)", () => {
    const visible = getVisibleNavItems("admin");

    expect(visible.map((item) => item.href).sort()).toEqual(
      ["/admin", "/partner", "/partners", "/technician"].sort(),
    );
  });

  it("should show the admin and partners links to operations_manager", () => {
    const visible = getVisibleNavItems("operations_manager");

    expect(visible.map((item) => item.href).sort()).toEqual(
      ["/admin", "/partners"].sort(),
    );
  });

  it("should show only the technician link to technician", () => {
    const visible = getVisibleNavItems("technician");

    expect(visible.map((item) => item.href)).toEqual(["/technician"]);
  });

  it("should show only the partner link to partner_user", () => {
    const visible = getVisibleNavItems("partner_user");

    expect(visible.map((item) => item.href)).toEqual(["/partner"]);
  });
});
