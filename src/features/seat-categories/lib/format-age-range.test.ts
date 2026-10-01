import { describe, expect, it } from "vitest";

import { formatAgeRange } from "@/features/seat-categories/lib/format-age-range";

describe("formatAgeRange", () => {
  it("should format a range in months", () => {
    expect(formatAgeRange(0, 12)).toBe("0-12 months");
  });

  it("should use the singular unit when the max is 1", () => {
    expect(formatAgeRange(0, 1)).toBe("0-1 month");
  });
});
