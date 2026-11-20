import { describe, expect, it } from "vitest";

import robots from "@/app/robots";

describe("robots", () => {
  it("should disallow every path for every crawler", () => {
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("should not publish a sitemap for a private workspace", () => {
    expect(robots().sitemap).toBeUndefined();
  });
});
