import { describe, expect, it } from "vitest";

import { hasUnsavedInspection } from "@/features/inspections/lib/unsaved-inspection";

describe("hasUnsavedInspection", () => {
  it.each([
    [{ result: "pass" as const }],
    [{ notes: "Strap worn" }],
    [{ result: "fail" as const, notes: "Cracked" }],
  ])("should return true when the form holds %j", (values) => {
    expect(hasUnsavedInspection(values)).toBe(true);
  });

  it.each([[{}], [{ notes: "" }], [{ notes: "   " }]])(
    "should return false when the form holds %j",
    (values) => {
      expect(hasUnsavedInspection(values)).toBe(false);
    },
  );
});
