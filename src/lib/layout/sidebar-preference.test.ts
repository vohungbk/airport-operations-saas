import { describe, expect, it } from "vitest";

import {
  SIDEBAR_COOKIE,
  SIDEBAR_WIDTH_CLASS,
  parseSidebarCollapsed,
  sidebarCookie,
} from "@/lib/layout/sidebar-preference";

describe("parseSidebarCollapsed", () => {
  it("should read 1 as collapsed and 0 as expanded", () => {
    expect(parseSidebarCollapsed("1")).toBe(true);
    expect(parseSidebarCollapsed("0")).toBe(false);
  });

  it.each([undefined, null, "", "true", "yes", "2", "collapsed", " 1"])(
    "should be expanded when the saved value is %j",
    (raw) => {
      expect(parseSidebarCollapsed(raw)).toBe(false);
    },
  );
});

describe("sidebarCookie", () => {
  it("should name the cookie and hold only 1 or 0", () => {
    expect(sidebarCookie(true)).toMatch(new RegExp(`^${SIDEBAR_COOKIE}=1;`));
    expect(sidebarCookie(false)).toMatch(new RegExp(`^${SIDEBAR_COOKIE}=0;`));
  });

  it("should apply to the whole site and last a year", () => {
    const cookie = sidebarCookie(true);

    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("should give back the same choice when it is read again", () => {
    for (const collapsed of [true, false]) {
      const value = sidebarCookie(collapsed).split(";")[0].split("=")[1];

      expect(parseSidebarCollapsed(value)).toBe(collapsed);
    }
  });
});

describe("SIDEBAR_WIDTH_CLASS", () => {
  it("should be 256 px expanded and 72 px collapsed on the 4 px grid", () => {
    expect(SIDEBAR_WIDTH_CLASS.expanded).toBe("md:w-64");
    expect(SIDEBAR_WIDTH_CLASS.collapsed).toBe("md:w-18");
    // w-N is N steps of 4 px: 64 steps is 256 px and 18 steps is 72 px.
    expect(64 * 4).toBe(256);
    expect(18 * 4).toBe(72);
  });
});
