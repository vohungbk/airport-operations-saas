import { describe, expect, it } from "vitest";

import { BOOKING_BOARD_STEPS, BOARD_PRIORITY_LABEL, stepOf } from "@/lib/workflow/board";

describe("stepOf", () => {
  it("should give the first step for a pending booking", () => {
    expect(stepOf("pending")).toEqual({ number: 1, total: 5, label: "Pending" });
  });

  it("should give the last step for a completed booking", () => {
    expect(stepOf("completed")).toEqual({ number: 5, total: 5, label: "Completed" });
  });

  it.each(["cancelled", "no_show"] as const)("should give no step for a %s booking", (status) => {
    expect(stepOf(status)).toBeNull();
  });

  it("should number the steps in order", () => {
    expect(BOOKING_BOARD_STEPS.map((status) => stepOf(status)?.number)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("BOARD_PRIORITY_LABEL", () => {
  it("should word every priority", () => {
    expect(Object.keys(BOARD_PRIORITY_LABEL)).toEqual(["normal", "high", "urgent"]);
  });
});
