import { describe, expect, it } from "vitest";

import { SEAT_STATUSES } from "@/features/seats/lib/seat-status";
import { canStartCleaningOnSeat } from "@/features/cleaning/lib/seat-eligibility";

describe("canStartCleaningOnSeat", () => {
  it("should allow a seat that is available", () => {
    expect(canStartCleaningOnSeat("available")).toBe(true);
  });

  it.each(
    SEAT_STATUSES.filter((status) => status !== "available").map((s) => [s]),
  )("should not allow a seat that is %s", (status) => {
    expect(canStartCleaningOnSeat(status)).toBe(false);
  });
});
