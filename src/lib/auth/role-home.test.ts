import { describe, expect, it } from "vitest";

import { getHomeRouteForRole } from "@/lib/auth/role-home";
import { ROLES } from "@/lib/auth/roles";

describe("getHomeRouteForRole", () => {
  it("should send an admin to the dashboard", () => {
    expect(getHomeRouteForRole("admin")).toBe("/dashboard");
  });

  it("should send an operations manager to the dashboard", () => {
    expect(getHomeRouteForRole("operations_manager")).toBe("/dashboard");
  });

  it("should send a technician to the technician home", () => {
    expect(getHomeRouteForRole("technician")).toBe("/technician");
  });

  it("should send a partner user to the partner home", () => {
    expect(getHomeRouteForRole("partner_user")).toBe("/partner");
  });

  it("should give every role of the database a home inside the app", () => {
    for (const role of ROLES) {
      expect(getHomeRouteForRole(role)).toMatch(/^\/[a-z]+$/);
    }
  });
});
