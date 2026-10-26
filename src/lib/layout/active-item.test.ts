import { describe, expect, it } from "vitest";

import { findActiveHref, isUnderHref } from "@/lib/layout/active-item";

const PARTNER_MENU = [
  { href: "/partner" },
  { href: "/bookings" },
  { href: "/partner/seats" },
  { href: "/settlements" },
];

describe("isUnderHref", () => {
  it("should be true for the address itself and for a page below it", () => {
    expect(isUnderHref("/partners", "/partners")).toBe(true);
    expect(isUnderHref("/partners/123", "/partners")).toBe(true);
  });

  it("should not take /partners for a page under /partner", () => {
    expect(isUnderHref("/partners", "/partner")).toBe(false);
    expect(isUnderHref("/partner", "/partners")).toBe(false);
  });
});

describe("findActiveHref", () => {
  it("should mark the item whose address the page is under", () => {
    expect(findActiveHref("/bookings/123/edit", PARTNER_MENU)).toBe("/bookings");
  });

  it("should mark only the longest match when two items match, not both", () => {
    expect(findActiveHref("/partner/seats", PARTNER_MENU)).toBe("/partner/seats");
    expect(findActiveHref("/partner", PARTNER_MENU)).toBe("/partner");
  });

  it("should mark the shorter item for a page that only it covers", () => {
    expect(findActiveHref("/partner/anything", PARTNER_MENU)).toBe("/partner");
  });

  it("should mark nothing when the page is under no item", () => {
    expect(findActiveHref("/forbidden", PARTNER_MENU)).toBeNull();
    expect(findActiveHref("/anything", [])).toBeNull();
  });

  it("should not depend on the order of the items", () => {
    expect(findActiveHref("/partner/seats", [...PARTNER_MENU].reverse())).toBe("/partner/seats");
  });
});
