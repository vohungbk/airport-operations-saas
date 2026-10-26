import { describe, expect, it } from "vitest";

import { isChecklistComplete, remainingRequired } from "@/lib/field/checklist";

describe("checklist", () => {
  it("should count the required items that are not checked", () => {
    expect(
      remainingRequired([
        { required: true, checked: false },
        { required: true, checked: true },
        { required: false, checked: false },
      ]),
    ).toBe(1);
  });

  it("should be complete when every required item is checked", () => {
    expect(isChecklistComplete([{ required: true, checked: true }, { required: false, checked: false }])).toBe(true);
  });

  it("should not be complete while a required item is open", () => {
    expect(isChecklistComplete([{ required: true, checked: false }])).toBe(false);
  });

  it("should be complete for an empty list", () => {
    expect(isChecklistComplete([])).toBe(true);
  });
});
