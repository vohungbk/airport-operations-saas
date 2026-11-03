import { describe, expect, it } from "vitest";

import { BOOKING_BOARD_STEPS, BOARD_PRIORITY_LABEL, stepOf } from "@/lib/workflow/board";

describe("stepOf", () => {
  it("should give the first step for a new booking", () => {
    expect(stepOf("pending")).toEqual({ number: 1, total: 13, label: "New" });
  });

  it("should give the last step for an available booking", () => {
    expect(stepOf("completed")).toEqual({ number: 13, total: 13, label: "Available" });
  });

  it.each(["cancelled", "no_show"] as const)("should give no step for a %s booking", (status) => {
    expect(stepOf(status)).toBeNull();
  });

  it("should number the steps in order", () => {
    expect(BOOKING_BOARD_STEPS.map((status) => stepOf(status)?.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });
});

describe("BOARD_PRIORITY_LABEL", () => {
  it("should word every priority", () => {
    expect(Object.keys(BOARD_PRIORITY_LABEL)).toEqual(["normal", "high", "urgent"]);
  });
});
