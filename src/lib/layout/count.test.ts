import { describe, expect, it } from "vitest";

import { MAX_SHOWN_COUNT, formatCount } from "@/lib/layout/count";

describe("formatCount", () => {
  it.each([
    [1, "1"],
    [7, "7"],
    [99, "99"],
  ])("should write %d as %s", (count, text) => {
    expect(formatCount(count)).toBe(text);
  });

  it.each([100, 101, 12345])("should write %d as 99+", (count) => {
    expect(formatCount(count)).toBe("99+");
  });

  it.each([0, -3, 0.4, Number.NaN, Number.POSITIVE_INFINITY])(
    "should show nothing for %s",
    (count) => {
      expect(formatCount(count)).toBeNull();
    },
  );

  it("should cut a fraction to a whole number", () => {
    expect(formatCount(4.9)).toBe("4");
    expect(formatCount(99.9)).toBe("99");
  });

  it("should switch to 99+ right after the largest shown count", () => {
    expect(MAX_SHOWN_COUNT).toBe(99);
    expect(formatCount(MAX_SHOWN_COUNT)).toBe("99");
    expect(formatCount(MAX_SHOWN_COUNT + 1)).toBe("99+");
  });
});
