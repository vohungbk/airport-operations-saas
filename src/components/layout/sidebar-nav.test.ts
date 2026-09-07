import { describe, expect, it } from "vitest";

import { isNavItemActive } from "@/components/layout/sidebar-nav";

describe("isNavItemActive", () => {
  it("should return true when pathname exactly matches href", () => {
    expect(isNavItemActive("/partners", "/partners")).toBe(true);
  });

  it("should return true when pathname is a sub-route of href", () => {
    expect(isNavItemActive("/partners/123", "/partners")).toBe(true);
  });

  it("should not activate '/partner' when pathname is '/partners'", () => {
    expect(isNavItemActive("/partners", "/partner")).toBe(false);
  });

  it("should not activate '/partners' when pathname is '/partner'", () => {
    expect(isNavItemActive("/partner", "/partners")).toBe(false);
  });

  it("should return false when pathname does not match href at all", () => {
    expect(isNavItemActive("/airports", "/partners")).toBe(false);
  });

  it("should return true for the root path when pathname and href are both '/'", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
  });
});
