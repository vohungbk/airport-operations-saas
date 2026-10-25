import { readFileSync } from "node:fs";
import { join } from "node:path";

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

describe("sidebar nav markup", () => {
  const nav = readFileSync(
    join(process.cwd(), "src", "components", "layout", "sidebar-nav.tsx"),
    "utf8",
  );

  it("should be a labelled navigation landmark", () => {
    expect(nav).toContain('<nav aria-label="Main navigation"');
  });

  it("should mark the current item for assistive technology and with a marker", () => {
    expect(nav).toContain('aria-current={isActive ? "page" : undefined}');
    expect(nav).toContain("before:bg-primary");
  });

  it("should cut a long label and show it in full in a tooltip only when it is cut", () => {
    expect(nav).toContain('className={cn("truncate", collapsed && "sr-only")}');
    expect(nav).toContain("useIsTruncated<HTMLSpanElement>()");
    expect(nav).toContain("<Tooltip disabled={!collapsed && !truncated}>");
    expect(nav).toContain("<TooltipContent>{item.label}</TooltipContent>");
  });

  it("should keep the label for screen readers when collapsed", () => {
    expect(nav).toContain('collapsed && "sr-only"');
  });

  it("should show a count only when an item has one, and only while expanded", () => {
    expect(nav).toContain("!collapsed && item.count !== undefined && <CountBadge count={item.count} />");
  });
});
