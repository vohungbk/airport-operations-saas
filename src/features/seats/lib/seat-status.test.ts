import { describe, expect, it } from "vitest";

import {
  MANUAL_TARGET_STATUSES,
  SEAT_STATUSES,
  getAllowedManualTransitions,
} from "@/features/seats/lib/seat-status";

describe("seat status manual transitions", () => {
  it("should allow available to quarantine and retired", () => {
    expect(getAllowedManualTransitions("available")).toEqual([
      "quarantine",
      "retired",
    ]);
  });

  it("should allow quarantine back to available and on to retired", () => {
    expect(getAllowedManualTransitions("quarantine")).toEqual([
      "available",
      "retired",
    ]);
  });

  it("should treat retired as terminal", () => {
    expect(getAllowedManualTransitions("retired")).toEqual([]);
  });

  it.each(["reserved", "in_use", "cleaning", "inspection"] as const)(
    "should offer no manual transitions out of operational status %s",
    (status) => {
      expect(getAllowedManualTransitions(status)).toEqual([]);
    },
  );

  it("should never allow an operational status as a manual target", () => {
    for (const from of SEAT_STATUSES) {
      for (const to of getAllowedManualTransitions(from)) {
        expect(MANUAL_TARGET_STATUSES).toContain(to);
      }
    }
  });
});
