import { describe, expect, it } from "vitest";

import {
  INSTALLATION_CHECKLIST,
  getChecklistHint,
  getChecklistIncompleteMessage,
  getMissingChecklistItems,
  toggleChecklistKey,
} from "@/features/installations/lib/installation-checklist";

const ALL_KEYS = INSTALLATION_CHECKLIST.map((item) => item.key);

describe("installation checklist", () => {
  it("should list no missing item when every item is checked", () => {
    expect(getMissingChecklistItems(ALL_KEYS)).toEqual([]);
  });

  it("should list the unchecked items in the order of the checklist", () => {
    expect(
      getMissingChecklistItems(["isofix_belt"]).map((item) => item.key),
    ).toEqual([
      "category_and_fit",
      "shell_and_harness",
      "seat_movement",
      "harness_tension",
      "final_safety",
    ]);
  });

  it("should check an item and keep the order of the checklist", () => {
    expect(toggleChecklistKey(["final_safety"], "category_and_fit")).toEqual([
      "category_and_fit",
      "final_safety",
    ]);
  });

  it("should uncheck an item that is checked", () => {
    expect(
      toggleChecklistKey(["category_and_fit", "isofix_belt"], "isofix_belt"),
    ).toEqual(["category_and_fit"]);
  });

  it.each([
    [0, null],
    [1, "Complete the final check to continue."],
    [2, "Complete the final two checks to continue."],
    [5, "Complete the remaining 5 checks to continue."],
  ])("should return the hint for %i item(s) left", (remaining, hint) => {
    expect(getChecklistHint(remaining)).toBe(hint);
  });

  it("should name every missing item in the incomplete message", () => {
    expect(getChecklistIncompleteMessage(ALL_KEYS.slice(0, 4))).toBe(
      "Complete every checklist item. Missing: Harness height and tension verified; Final safety check completed.",
    );
  });
});
