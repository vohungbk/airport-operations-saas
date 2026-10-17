import { describe, expect, it } from "vitest";

import { SEAT_STATUSES } from "@/features/seats/lib/seat-status";
import { isSeatEligibleForCleaning } from "@/features/cleaning/lib/seat-eligibility";

describe("isSeatEligibleForCleaning", () => {
  it.each(
    SEAT_STATUSES.filter((status) => status !== "retired").map((s) => [s]),
  )("should allow a seat that is %s", (status) => {
    expect(isSeatEligibleForCleaning(status)).toBe(true);
  });

  it("should reject a retired seat, which is terminal", () => {
    expect(isSeatEligibleForCleaning("retired")).toBe(false);
  });
});
