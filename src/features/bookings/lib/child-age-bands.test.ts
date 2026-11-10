import { describe, expect, it } from "vitest";

import { childAgeBandChoices } from "@/features/bookings/lib/child-age-bands";

describe("childAgeBandChoices", () => {
  it("should offer the four bands of the design", () => {
    expect(childAgeBandChoices()).toEqual([
      "0-12 months",
      "12-24 months",
      "24-48 months",
      "4-8 years",
    ]);
  });

  it("should keep a saved value that is not one of the bands", () => {
    expect(childAgeBandChoices("toddler")[0]).toBe("toddler");
  });

  it("should not repeat a saved value that is already a band", () => {
    expect(childAgeBandChoices("24-48 months")).toHaveLength(4);
  });
});
