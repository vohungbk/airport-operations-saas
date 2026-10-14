import { describe, expect, it } from "vitest";

import {
  DESKTOP_MEDIA_QUERY,
  isMobileNavOpen,
} from "@/components/layout/use-mobile-nav";

describe("isMobileNavOpen", () => {
  it("should return true when the drawer was opened on the current route", () => {
    expect(isMobileNavOpen("/partners", "/partners")).toBe(true);
  });

  it("should return false when the route changed after opening", () => {
    expect(isMobileNavOpen("/partners", "/airports")).toBe(false);
  });

  it("should return false when the drawer was never opened", () => {
    expect(isMobileNavOpen(null, "/partners")).toBe(false);
  });
});

describe("DESKTOP_MEDIA_QUERY", () => {
  it("should match the md breakpoint used by the shell", () => {
    expect(DESKTOP_MEDIA_QUERY).toBe("(min-width: 768px)");
  });
});
