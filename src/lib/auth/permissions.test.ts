import { describe, expect, it } from "vitest";

import { hasPermission, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";

const ALL_PERMISSIONS: Permission[] = [
  "airports:manage",
  "partners:manage",
  "seats:manage",
  "bookings:manage",
  "technicians:manage",
  "cleaning:manage",
  "inspections:manage",
  "incidents:view",
  "finance:view",
  "dashboards:view",
  "jobs:view_assigned",
  "jobs:update_assigned",
  "installation:perform",
  "cleaning:create",
  "inspections:create",
  "incidents:report",
  "bookings:view_own_partner",
  "seats:view_own_partner",
  "operations:view_own_partner",
  "finance:view_own_partner",
];

describe("hasPermission", () => {
  describe("admin", () => {
    it("should return true for every permission in the model", () => {
      for (const permission of ALL_PERMISSIONS) {
        expect(hasPermission("admin", permission)).toBe(true);
      }
    });

    it("should return true for a permission not in any role's explicit list (full system access)", () => {
      // Cast is intentional: proves the short-circuit doesn't depend on
      // ROLE_PERMISSIONS containing the value at all.
      expect(
        hasPermission("admin", "not-a-real-permission" as Permission),
      ).toBe(true);
    });
  });

  describe("operations_manager", () => {
    it("should return true for every permission in its own list", () => {
      for (const permission of ROLE_PERMISSIONS.operations_manager) {
        expect(hasPermission("operations_manager", permission)).toBe(true);
      }
    });

    it("should return false for a permission that belongs to another role", () => {
      expect(hasPermission("operations_manager", "jobs:view_assigned")).toBe(
        false,
      );
    });
  });

  describe("technician", () => {
    it("should return true for every permission in its own list", () => {
      for (const permission of ROLE_PERMISSIONS.technician) {
        expect(hasPermission("technician", permission)).toBe(true);
      }
    });

    it("should return false for finance:view, which technician does not hold", () => {
      expect(hasPermission("technician", "finance:view")).toBe(false);
    });

    it("should return false for a partner-scoped permission", () => {
      expect(hasPermission("technician", "bookings:view_own_partner")).toBe(
        false,
      );
    });
  });

  describe("partner_user", () => {
    it("should return true for every permission in its own list", () => {
      for (const permission of ROLE_PERMISSIONS.partner_user) {
        expect(hasPermission("partner_user", permission)).toBe(true);
      }
    });

    it("should return false for a manager-only permission", () => {
      expect(hasPermission("partner_user", "partners:manage")).toBe(false);
    });

    it("should return false for a technician-only permission", () => {
      expect(hasPermission("partner_user", "jobs:view_assigned")).toBe(false);
    });
  });
});
