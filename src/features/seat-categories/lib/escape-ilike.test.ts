import { describe, expect, it } from "vitest";

import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";

describe("escapeIlikeValue", () => {
  it("should leave plain text unchanged", () => {
    expect(escapeIlikeValue("Booster")).toBe("Booster");
  });

  it("should escape %, _ and backslash", () => {
    expect(escapeIlikeValue("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });
});
