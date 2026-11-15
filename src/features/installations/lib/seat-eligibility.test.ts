import { describe, expect, it } from "vitest";

import { SEAT_STATUSES } from "@/features/seats/lib/seat-status";
import {
  INSTALLABLE_SEAT_STATUSES,
  isSeatCategoryMatch,
  isSeatEligibleForInstallation,
} from "@/features/installations/lib/seat-eligibility";

describe("isSeatEligibleForInstallation", () => {
  it.each([["available"], ["reserved"]] as const)(
    "should allow a seat that is %s",
    (status) => {
      expect(isSeatEligibleForInstallation(status)).toBe(true);
    },
  );

  it.each([
    ["in_use"],
    ["cleaning"],
    ["inspection"],
    ["quarantine"],
    ["retired"],
  ] as const)("should reject a seat that is %s", (status) => {
    expect(isSeatEligibleForInstallation(status)).toBe(false);
  });

  it("should only list known seat statuses", () => {
    for (const status of INSTALLABLE_SEAT_STATUSES) {
      expect(SEAT_STATUSES).toContain(status);
    }
  });
});

describe("isSeatCategoryMatch", () => {
  it.each([
    ["the seat has the required category", { id: "c-1" }, "c-1", true],
    ["the seat has another category", { id: "c-1" }, "c-2", false],
    ["the seat has no category", { id: "c-1" }, null, false],
    ["the booking requires no category", null, "c-2", true],
  ])("should return the right result when %s", (_name, required, seatCategory, expected) => {
    expect(isSeatCategoryMatch(required, seatCategory)).toBe(expected);
  });
});
